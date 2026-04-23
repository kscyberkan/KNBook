/**
 * Admin API handlers — ใช้ simple token auth ผ่าน header X-Admin-Token
 * Token เก็บใน env ADMIN_TOKEN
 */
import prisma from '../prisma/client';
import { sessions } from '../network/session';

const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? 'admin-secret';

export function requireAdminAuth(req: Request): boolean {
    const token = req.headers.get('x-admin-token');
    return token === ADMIN_TOKEN;
}

function unauthorized() {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
    });
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export async function getStats() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart); weekStart.setDate(todayStart.getDate() - 6);

    const [totalUsers, newUsersToday, totalPosts, newPostsToday, totalReports, onlineCount,
        dailyLogins, weeklyPosts] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
        prisma.post.count(),
        prisma.post.count({ where: { createdAt: { gte: todayStart } } }),
        prisma.report.count({ where: { createdAt: { gte: todayStart } } }),
        Promise.resolve(sessions.size),
        // login activity ย้อนหลัง 7 วัน (นับจาก updatedAt ของ user)
        prisma.$queryRaw<{ date: string; count: bigint }[]>`
            SELECT DATE("updatedAt") as date, COUNT(*) as count
            FROM "User"
            WHERE "updatedAt" >= ${weekStart}
            GROUP BY DATE("updatedAt")
            ORDER BY date ASC
        `,
        // posts ย้อนหลัง 7 วัน
        prisma.$queryRaw<{ date: string; count: bigint }[]>`
            SELECT DATE("createdAt") as date, COUNT(*) as count
            FROM "Post"
            WHERE "createdAt" >= ${weekStart}
            GROUP BY DATE("createdAt")
            ORDER BY date ASC
        `,
    ]);

    return Response.json({
        totalUsers, newUsersToday, totalPosts, newPostsToday,
        totalReports, onlineCount,
        dailyLogins: dailyLogins.map(r => ({ date: r.date, count: Number(r.count) })),
        weeklyPosts: weeklyPosts.map(r => ({ date: r.date, count: Number(r.count) })),
    });
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function getUsers(req: Request) {
    const url = new URL(req.url);
    const page = Number(url.searchParams.get('page') ?? 1);
    const search = url.searchParams.get('search') ?? '';
    const limit = 20;

    const where = search ? {
        OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { username: { contains: search, mode: 'insensitive' as const } },
        ]
    } : {};

    const [users, total] = await Promise.all([
        prisma.user.findMany({
            where,
            select: {
                id: true, name: true, username: true, profileImage: true,
                createdAt: true, banned: true,
                _count: { select: { posts: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: (page - 1) * limit,
        }),
        prisma.user.count({ where }),
    ]);

    return Response.json({ users, total, page, pages: Math.ceil(total / limit) });
}

export async function banUser(req: Request) {
    const { userId, banned }: { userId: number; banned: boolean } = await req.json();
    await prisma.user.update({ where: { id: userId }, data: { banned } });
    await prisma.adminLog.create({ data: { action: banned ? 'ban_user' : 'unban_user', targetId: userId } });

    // ถ้าแบน — เตะออกจาก session ทันทีด้วย FORCE_LOGOUT
    if (banned) {
        const { sessions } = await import('../network/session');
        const { PacketSC } = await import('../network/packetList');
        const Packet = (await import('../network/packet')).default;
        const sock = sessions.get(userId);
        if (sock) {
            const p = new Packet(PacketSC.FORCE_LOGOUT);
            p.writeString('บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ');
            try { sock.send(p.toBuffer()); sock.close(); } catch { /* ignore */ }
        }
    }

    return Response.json({ ok: true });
}

// ─── Posts ────────────────────────────────────────────────────────────────────

export async function getPosts(req: Request) {
    const url = new URL(req.url);
    const page = Number(url.searchParams.get('page') ?? 1);
    const limit = 20;

    const [posts, total] = await Promise.all([
        prisma.post.findMany({
            include: {
                user: { select: { id: true, name: true, profileImage: true } },
                _count: { select: { reactions: true, comments: true, reports: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: (page - 1) * limit,
        }),
        prisma.post.count(),
    ]);

    return Response.json({ posts, total, page, pages: Math.ceil(total / limit) });
}

export async function getPostDetail(_req: Request, postId: number) {
    const post = await prisma.post.findUnique({
        where: { id: postId },
        include: {
            user: { select: { id: true, name: true, profileImage: true } },
            reactions: { include: { user: { select: { name: true } } } },
            comments: {
                include: { user: { select: { id: true, name: true, profileImage: true } } },
                orderBy: { createdAt: 'asc' },
            },
            reports: {
                include: { user: { select: { id: true, name: true } } },
                orderBy: { createdAt: 'desc' },
            },
            _count: { select: { reactions: true, comments: true, reports: true } },
        },
    });
    if (!post) return new Response('Not found', { status: 404 });
    return Response.json(post);
}

export async function restorePost(req: Request) {
    const { postId }: { postId: number } = await req.json();
    const post = await prisma.post.update({
        where: { id: postId },
        data: { isActive: true },
        include: { user: { select: { name: true } } },
    });
    await prisma.adminLog.create({
        data: {
            action: 'restore_post',
            targetId: postId,
            postId,
            detail: `กู้คืนโพสต์ของ ${post.user.name}: ${post.text?.slice(0, 80) ?? '(ไม่มีข้อความ)'}`,
        },
    });
    return Response.json({ ok: true });
}

export async function adminDeletePost(req: Request) {
    const { postId }: { postId: number } = await req.json();
    // soft delete — set isActive=false แทนลบจริง
    const post = await prisma.post.update({
        where: { id: postId },
        data: { isActive: false },
        include: { user: { select: { name: true } } },
    });
    await prisma.adminLog.create({
        data: {
            action: 'delete_post',
            targetId: postId,
            postId,
            detail: `โพสต์ของ ${post.user.name}: ${post.text?.slice(0, 80) ?? '(ไม่มีข้อความ)'}`,
        },
    });
    return Response.json({ ok: true });
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export async function getReports(req: Request) {
    const url = new URL(req.url);
    const page = Number(url.searchParams.get('page') ?? 1);
    const limit = 20;

    const [reports, total] = await Promise.all([
        prisma.report.findMany({
            include: {
                user: { select: { id: true, name: true, profileImage: true } },
                post: {
                    include: {
                        user: { select: { id: true, name: true } },
                        _count: { select: { reports: true } },
                    }
                },
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: (page - 1) * limit,
        }),
        prisma.report.count(),
    ]);

    return Response.json({ reports, total, page, pages: Math.ceil(total / limit) });
}

export async function dismissReport(req: Request) {
    const { reportId }: { reportId: number } = await req.json();
    const report = await prisma.report.findUnique({
        where: { id: reportId },
        include: { user: { select: { name: true } }, post: { select: { id: true, text: true } } },
    });
    await prisma.report.delete({ where: { id: reportId } });
    await prisma.adminLog.create({
        data: {
            action: 'dismiss_report',
            targetId: reportId,
            postId: report?.post.id,
            detail: `รายงานจาก ${report?.user.name ?? '?'}: ${report?.reason ?? ''} | โพสต์ #${report?.post.id}: ${report?.post.text?.slice(0, 60) ?? '(ไม่มีข้อความ)'}`,
        },
    });
    return Response.json({ ok: true });
}

// ─── Router ───────────────────────────────────────────────────────────────────

export async function handleAdminApi(req: Request): Promise<Response> {
    if (!requireAdminAuth(req)) return unauthorized();

    const url = new URL(req.url);
    const path = url.pathname.replace('/api/admin', '');
    const method = req.method;

    if (path === '/stats' && method === 'GET') return getStats();
    if (path === '/users' && method === 'GET') return getUsers(req);
    if (path === '/users/ban' && method === 'POST') return banUser(req);
    if (path === '/posts' && method === 'GET') return getPosts(req);
    if (path.match(/^\/posts\/\d+$/) && method === 'GET') return getPostDetail(req, Number(path.split('/')[2]));
    if (path === '/posts/delete' && method === 'POST') return adminDeletePost(req);
    if (path === '/posts/restore' && method === 'POST') return restorePost(req);
    if (path === '/reports' && method === 'GET') return getReports(req);
    if (path === '/reports/dismiss' && method === 'POST') return dismissReport(req);
    if (path === '/logs' && method === 'GET') return getAuditLogs(req);
    if (path === '/export/users' && method === 'GET') return exportUsersCSV();
    if (path === '/export/stats' && method === 'GET') return exportStatsCSV();

    return new Response('Not found', { status: 404 });
}

// ─── Audit Log ────────────────────────────────────────────────────────────────

export async function getAuditLogs(req: Request) {
    const url = new URL(req.url);
    const page = Number(url.searchParams.get('page') ?? 1);
    const limit = 50;
    const [logs, total] = await Promise.all([
        prisma.adminLog.findMany({ orderBy: { createdAt: 'desc' }, take: limit, skip: (page - 1) * limit }),
        prisma.adminLog.count(),
    ]);
    return Response.json({ logs, total, page, pages: Math.ceil(total / limit) });
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

export async function exportUsersCSV() {
    const users = await prisma.user.findMany({
        select: { id: true, name: true, username: true, createdAt: true, banned: true, _count: { select: { posts: true } } },
        orderBy: { createdAt: 'desc' },
    });
    const rows = [
        'ID,ชื่อ,Username,สมัครเมื่อ,สถานะ,จำนวนโพสต์',
        ...users.map(u => `${u.id},"${u.name}","${u.username}","${u.createdAt.toISOString()}","${u.banned ? 'แบน' : 'ปกติ'}",${u._count.posts}`),
    ].join('\n');
    return new Response('\uFEFF' + rows, {
        headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="users.csv"' },
    });
}

export async function exportStatsCSV() {
    const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 29);
    const posts = await prisma.$queryRaw<{ date: string; count: bigint }[]>`
        SELECT DATE("createdAt") as date, COUNT(*) as count FROM "Post"
        WHERE "createdAt" >= ${weekStart} GROUP BY DATE("createdAt") ORDER BY date ASC
    `;
    const rows = ['วันที่,จำนวนโพสต์', ...posts.map(r => `"${r.date}",${Number(r.count)}`)].join('\n');
    return new Response('\uFEFF' + rows, {
        headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="stats.csv"' },
    });
}
