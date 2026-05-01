import prisma from './client';
import type { Post } from '@prisma/client';

export type PostWithRelations = Post & {
    user: { id: number; name: string; profileImage: string | null };
    reactions: { type: string; userId: number; user: { name: string } }[];
    comments: { id: number; text: string; createdAt: Date; user: { id: number; name: string; profileImage: string | null } }[];
    sharedFrom?: PostWithRelations | null;
};

const baseInclude = {
    user: { select: { id: true, name: true, profileImage: true } },
    reactions: { include: { user: { select: { name: true } } } },
    comments: {
        include: {
            user: { select: { id: true, name: true, profileImage: true } },
            // ดึงชื่อคนที่ถูก reply
            replyToComment: {
                select: { user: { select: { name: true } } }
            },
        },
        orderBy: { createdAt: 'asc' as const },
    },
};

const postInclude = {
    ...baseInclude,
    sharedFrom: { include: baseInclude }, // 1 ชั้นพอ — resolveSharedChain จะ fetch ที่เหลือ
};

/** Resolve sharedFrom chain ทุกชั้นด้วย loop (ไม่จำกัดความลึก) */
async function resolveSharedChain(post: any): Promise<any> {
    if (!post?.sharedFromId) return post;

    // สร้าง map id → node เพื่อ detect circular reference
    const visited = new Set<number>();

    // traverse ลงไปหา node ที่ยังไม่มี sharedFrom แต่มี sharedFromId
    async function resolve(node: any): Promise<any> {
        if (!node || !node.sharedFromId) return node;
        if (visited.has(node.id)) return node; // circular guard
        visited.add(node.id);

        // ถ้า sharedFrom ยังไม่ได้ fetch
        if (!node.sharedFrom) {
            node.sharedFrom = await prisma.post.findUnique({
                where: { id: node.sharedFromId },
                include: baseInclude,
            });
        }

        // resolve ชั้นถัดไปแบบ recursive
        if (node.sharedFrom) {
            node.sharedFrom = await resolve(node.sharedFrom);
        }

        return node;
    }

    return resolve(post);
}

export async function getFeedPosts(userId: number, limit = 10, offset = 0): Promise<PostWithRelations[]> {
    // หา blocked user IDs
    const blocks = await prisma.block.findMany({
        where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
        select: { blockerId: true, blockedId: true },
    });
    const blockedIds = blocks.map(b => b.blockerId === userId ? b.blockedId : b.blockerId);

    const posts = await prisma.post.findMany({
        where: { isActive: true, userId: blockedIds.length > 0 ? { notIn: blockedIds } : undefined },
        include: postInclude,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
    });
    return Promise.all(posts.map(resolveSharedChain)) as Promise<PostWithRelations[]>;
}

export async function getPostsByUser(userId: number, limit = 10, offset = 0): Promise<PostWithRelations[]> {
    const posts = await prisma.post.findMany({
        where: { userId, isActive: true },
        include: postInclude,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
    });
    return Promise.all(posts.map(resolveSharedChain)) as Promise<PostWithRelations[]>;
}

export async function getPostById(id: number): Promise<PostWithRelations | null> {
    const post = await prisma.post.findUnique({
        where: { id },
        include: postInclude,
    });
    if (!post) return null;
    return resolveSharedChain(post) as Promise<PostWithRelations>;
}

export async function createPost(data: {
    userId: number;
    text?: string;
    imageUrl?: string;
    videoUrl?: string;
    feeling?: string;
    stickerUrl?: string;
    groupName?: string;
    sharedFromId?: number;
}): Promise<PostWithRelations> {
    const post = await prisma.post.create({
        data,
        include: postInclude,
    });
    return resolveSharedChain(post) as Promise<PostWithRelations>;
}

export async function deletePost(id: number, userId: number): Promise<void> {
    // user ลบโพสต์ตัวเอง — soft delete
    await prisma.post.updateMany({ where: { id, userId }, data: { isActive: false } });
}
