import Packet from '@network/packet';
import { PacketCS, PacketSC } from './packetList';
import { registerSession, removeSession, getUserId, broadcast, sendToUser, sessions, type WS } from './session';
import { getUserByUsername, getUserByToken, createUser, updateUser, getUserById } from '@/prisma/user';
import { getFeedPosts, getPostsByUser, createPost, deletePost } from '@/prisma/post';
import { upsertReaction, deleteReaction } from '@/prisma/reaction';
import { createComment } from '@/prisma/comment';
import prisma from '@/prisma/client';
import { createMessage, getConversation, markMessagesRead } from '@/prisma/message';
import { createNotification, upsertNotification, getNotifications, markNotificationRead, markAllNotificationsRead, markNotificationHandled } from '@/prisma/notification';
import { createReport } from '@/prisma/report';
import { addBookmark, removeBookmark, getBookmarks } from '@/prisma/bookmark';
import { checkRateLimit } from './rateLimit';
import { sanitizeText, sanitizeShort } from '@/utils/sanitize';
import { getFriendStatus, sendFriendRequest, acceptFriendRequest, removeFriend, getFriends, getPendingRequests, getSentRequests } from '@/prisma/friendship';
import { createDefaultAvatar } from '@/utils/defaultAvatar';

import * as bcrypt from 'bcryptjs';

type Handler = (socket: WS, packet: Packet) => Promise<void>;

const handlers = new Map<number, Handler>([
    [PacketCS.LOGIN, recvLogin],
    [PacketCS.REGISTER, recvRegister],
    [PacketCS.LOGOUT, recvLogout],
    [PacketCS.RESUME, recvResume],
    [PacketCS.CREATE_POST, recvCreatePost],
    [PacketCS.DELETE_POST, recvDeletePost],
    [PacketCS.GET_FEED, recvGetFeed],
    [PacketCS.GET_USER_POSTS, recvGetUserPosts],
    [PacketCS.REACT_POST, recvReactPost],
    [PacketCS.UNREACT_POST, recvUnreactPost],
    [PacketCS.CREATE_COMMENT, recvCreateComment],
    [PacketCS.SEND_MESSAGE, recvSendMessage],
    [PacketCS.GET_CONVERSATION, recvGetConversation],
    [PacketCS.READ_MESSAGES, recvReadMessages],
    [PacketCS.GET_NOTIFICATIONS, recvGetNotifications],
    [PacketCS.MARK_NOTIFICATION_READ, recvMarkNotifRead],
    [PacketCS.MARK_ALL_NOTIF_READ, recvMarkAllNotifRead],
    [PacketCS.UPDATE_PROFILE_IMAGE, recvUpdateProfileImage],
    [PacketCS.UPDATE_COVER_IMAGE, recvUpdateCoverImage],
    [PacketCS.UPDATE_PROFILE, recvUpdateProfile],
    [PacketCS.GET_FRIEND_STATUS, recvGetFriendStatus],
    [PacketCS.SEND_FRIEND_REQUEST, recvSendFriendRequest],
    [PacketCS.ACCEPT_FRIEND_REQUEST, recvAcceptFriendRequest],
    [PacketCS.REMOVE_FRIEND, recvRemoveFriend],
    [PacketCS.GET_FRIENDS, recvGetFriends],
    [PacketCS.GET_FRIENDS_PANEL,        recvGetFriendsPanel],
    [PacketCS.GET_USER_BY_ID,           recvGetUserById],
    [PacketCS.SEARCH_USERS,             recvSearchUsers],
    [PacketCS.GET_PENDING_REQUESTS,     recvGetPendingRequests],
    [PacketCS.GET_SENT_REQUESTS, recvGetSentRequests],
    [PacketCS.HANDLE_FRIEND_NOTIF, recvHandleFriendNotif],
    [PacketCS.REPORT_POST, recvReportPost],
    [PacketCS.BOOKMARK_POST, recvBookmarkPost],
    [PacketCS.UNBOOKMARK_POST, recvUnbookmarkPost],
    [PacketCS.GET_BOOKMARKS, recvGetBookmarks],
    [PacketCS.REACT_MESSAGE, recvReactMessage],
    [PacketCS.UNREACT_MESSAGE, recvUnreactMessage],
    [PacketCS.GET_BOOKMARK_IDS, recvGetBookmarkIds],
]);

// ─── Packet Queue ────────────────────────────────────────────────────────────

const queues = new Map<WS, Promise<void>>();

function enqueue(socket: WS, fn: () => Promise<void>): void {
    const prev = queues.get(socket) ?? Promise.resolve();
    const next = prev.then(fn).catch(e => {
        sendError(socket, `Internal error: ${e}`);
    });
    queues.set(socket, next);
}

export async function handler(socket: WS, packet: Packet): Promise<void> {
    const id = packet.getPacketID();
    const fn = handlers.get(id);
    if (fn) {
        enqueue(socket, () => fn(socket, packet));
    } else {
        sendError(socket, `Unknown packet: ${id}`);
    }
}

export function onDisconnect(socket: WS): void {
    const userId = getUserId(socket);
    queues.delete(socket);
    removeSession(socket);
    if (userId) broadcastOnlineStatus(userId, false);
}

/** broadcast online/offline status ให้เพื่อนทุกคนที่ online */
async function broadcastOnlineStatus(userId: number, online: boolean): Promise<void> {
    const friends = await getFriends(userId);
    const p = new Packet(PacketSC.FRIEND_ONLINE);
    p.writeInt(userId);
    p.writeBool(online);
    for (const f of friends) {
        sendToUser(f.id, p.toBuffer());
    }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function sendError(socket: WS, msg: string): void {
    const p = new Packet(PacketSC.ERROR);
    p.writeString(msg);
    socket.send(p.toBuffer());
}

function requireAuth(socket: WS): number | null {
    const userId = getUserId(socket);
    if (!userId) { sendError(socket, 'Not authenticated'); return null; }
    return userId;
}

/** แปลง Prisma reactions → { type, users: string[] }[] ที่ frontend ใช้ */
function groupReactions(raw: { type: string; userId: number; user: { name: string } }[]): { type: string; users: string[] }[] {
    const map = new Map<string, string[]>();
    for (const r of (raw ?? [])) {
        if (!map.has(r.type)) map.set(r.type, []);
        map.get(r.type)!.push(r.user.name);
    }
    return Array.from(map.entries()).map(([type, users]) => ({ type, users }));
}

/** normalize post จาก Prisma format → frontend format (recursive สำหรับ sharedPost) */
export function normalizePostForApi(p: any): any {
    return normalizePost(p);
}

function normalizePost(p: any): any {
    return {
        ...p,
        id: String(p.id),
        user: { ...p.user, id: String(p.user.id) },
        reactions: groupReactions(p.reactions ?? []),
        comments: (p.comments ?? []).map((c: any) => ({
            ...c,
            id: String(c.id),
            user: { ...c.user, id: String(c.user.id) },
            replyTo: c.replyToId ? String(c.replyToId) : undefined,
            replyToId: undefined,
            replyToName: c.replyToComment?.user?.name ?? undefined,
            replyToComment: undefined,
        })),
        sharedPost: p.sharedFrom ? normalizePost(p.sharedFrom) : undefined,
        sharedFrom: undefined, // ไม่ส่ง field นี้ไป frontend
    };
}
// ─── Auth ────────────────────────────────────────────────────────────────────

async function recvLogin(socket: WS, packet: Packet): Promise<void> {
    const username = packet.readString();
    const password = packet.readString();

    const user = await getUserByUsername(username);
    if (!user || !(await bcrypt.compare(password, user.password))) {
        const p = new Packet(PacketSC.REJECT_LOGIN);
        p.writeString('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
        socket.send(p.toBuffer());
        return;
    }

    if ((user as any).banned) {
        const p = new Packet(PacketSC.REJECT_LOGIN);
        p.writeString('บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ');
        socket.send(p.toBuffer());
        return;
    }

    const token = crypto.randomUUID();

    // ถ้ายังไม่มีรูป สร้าง default avatar — ทำพร้อมกับ update token
    let profileImage = user.profileImage;
    if (!profileImage) {
        profileImage = await createDefaultAvatar(String(user.id), user.name);
    }

    await updateUser(user.id, { token, profileImage });
    registerSession(user.id, socket);
    broadcastOnlineStatus(user.id, true);

    const p = new Packet(PacketSC.ACCEPT_LOGIN);
    p.writeInt(user.id);
    p.writeString(user.name);
    p.writeString(profileImage);
    p.writeString(token);
    p.writeString(user.nickname ?? '');
    p.writeString(user.phone ?? '');
    p.writeString(user.province ?? '');
    p.writeString(user.bio ?? '');
    p.writeString(user.coverImage ?? '');
    p.writeString(user.createdAt.toISOString());
    socket.send(p.toBuffer());
}

async function recvRegister(socket: WS, packet: Packet): Promise<void> {
    const username = packet.readString();
    const password = packet.readString();
    const name = packet.readString();
    const nickname = packet.readString();
    const phone = packet.readString();
    const province = packet.readString();

    const existing = await getUserByUsername(username);
    if (existing) {
        const p = new Packet(PacketSC.REJECT_REGISTER);
        p.writeString('ชื่อผู้ใช้นี้ถูกใช้แล้ว');
        socket.send(p.toBuffer());
        return;
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await createUser({ username, password: hashed, name });

    const [avatarUrl, token] = await Promise.all([
        createDefaultAvatar(String(user.id), name),
        Promise.resolve(crypto.randomUUID()),
    ]);

    await updateUser(user.id, {
        profileImage: avatarUrl,
        token,
        nickname: nickname || undefined,
        phone: phone || undefined,
        province: province || undefined,
    });
    registerSession(user.id, socket);

    const p = new Packet(PacketSC.ACCEPT_REGISTER);
    p.writeInt(user.id);
    p.writeString(user.name);
    p.writeString(avatarUrl);
    p.writeString(token);
    p.writeString(nickname);
    p.writeString(phone);
    p.writeString(province);
    socket.send(p.toBuffer());
}

async function recvLogout(socket: WS, _packet: Packet): Promise<void> {
    const userId = getUserId(socket);
    if (userId) await updateUser(userId, { token: undefined });
    removeSession(socket);
}

async function recvResume(socket: WS, packet: Packet): Promise<void> {
    const token = packet.readString();
    if (!token) return;

    const user = await getUserByToken(token);
    if (!user) {
        const p = new Packet(PacketSC.REJECT_LOGIN);
        p.writeString('session หมดอายุ กรุณาเข้าสู่ระบบใหม่');
        socket.send(p.toBuffer());
        return;
    }

    if ((user as any).banned) {
        const p = new Packet(PacketSC.FORCE_LOGOUT);
        p.writeString('บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ');
        socket.send(p.toBuffer());
        return;
    }

    registerSession(user.id, socket);
    broadcastOnlineStatus(user.id, true);

    const ok = new Packet(PacketSC.RESUME_OK);
    ok.writeInt(user.id);
    socket.send(ok.toBuffer());
}

// ─── Post ────────────────────────────────────────────────────────────────────

async function recvGetFeed(socket: WS, packet: Packet): Promise<void> {
    const offset = packet.readInt();
    const posts = await getFeedPosts(10, offset);

    const normalized = posts.map(normalizePost);

    const p = new Packet(PacketSC.POST_LIST);
    p.writeString(JSON.stringify(normalized));
    p.writeBool(posts.length === 10);
    socket.send(p.toBuffer());
}

async function recvGetUserPosts(socket: WS, packet: Packet): Promise<void> {
    const userId = packet.readInt();
    const offset = packet.readInt();
    const posts = await getPostsByUser(userId, 10, offset);

    const normalized = posts.map(normalizePost);

    const p = new Packet(PacketSC.USER_POST_LIST);
    p.writeString(JSON.stringify(normalized));
    p.writeBool(posts.length === 10); // hasMore
    socket.send(p.toBuffer());
}

async function recvCreatePost(socket: WS, packet: Packet): Promise<void> {
    const userId = requireAuth(socket);
    if (!userId) return;
    if (!checkRateLimit(userId, 'post', 5, 60_000)) { sendError(socket, 'โพสต์เร็วเกินไป กรุณารอสักครู่'); return; }

    const text = packet.readString();
    const imageUrl = packet.readString();
    const videoUrl = packet.readString();
    const feeling = packet.readString();
    const stickerUrl = packet.readString();
    const sharedFromId = packet.readInt();

    const post = await createPost({
        userId,
        text: sanitizeText(text) || undefined,
        imageUrl: imageUrl || undefined,
        videoUrl: videoUrl || undefined,
        feeling: sanitizeShort(feeling, 50) || undefined,
        stickerUrl: stickerUrl || undefined,
        sharedFromId: sharedFromId > 0 ? sharedFromId : undefined,
    });

    // broadcast โพสต์ใหม่ให้ทุกคน
    const p = new Packet(PacketSC.NEW_POST);
    p.writeString(JSON.stringify(normalizePost(post)));
    broadcast(p.toBuffer());
}

async function recvDeletePost(socket: WS, packet: Packet): Promise<void> {
    const userId = requireAuth(socket);
    if (!userId) return;

    const postId = packet.readInt();
    await deletePost(postId, userId);

    const p = new Packet(PacketSC.POST_DELETED);
    p.writeInt(postId);
    broadcast(p.toBuffer());
}

// ─── Reaction ────────────────────────────────────────────────────────────────

async function recvReactPost(socket: WS, packet: Packet): Promise<void> {
    const userId = requireAuth(socket);
    if (!userId) return;
    if (!checkRateLimit(userId, 'react', 30, 60_000)) return; // silent — reaction spam ไม่ต้องแจ้ง

    const postId = packet.readInt();
    const type = packet.readString();
    await upsertReaction(postId, userId, type);

    // notify เจ้าของโพส (ถ้าไม่ใช่ตัวเอง)
    const { getPostById } = await import('@/prisma/post');
    const post = await getPostById(postId);
    if (post && post.userId !== userId) {
        const { getUserById } = await import('@/prisma/user');
        const reactor = await getUserById(userId);
        if (reactor) {
            const notif = await upsertNotification({
                userId: post.userId,
                type: 'reaction',
                fromName: reactor.name,
                fromImage: reactor.profileImage ?? undefined,
                fromId: userId,
                refId: postId,
                message: `กด ${type} ในโพสของคุณ`,
            });
            const np = new Packet(PacketSC.NEW_NOTIFICATION);
            np.writeString(JSON.stringify(notif));
            sendToUser(post.userId, np.toBuffer());
        }
    }

    const p = new Packet(PacketSC.REACTION_UPDATE);
    p.writeInt(postId);
    p.writeString(JSON.stringify({ userId, type }));
    broadcast(p.toBuffer());
}

async function recvUnreactPost(socket: WS, packet: Packet): Promise<void> {
    const userId = requireAuth(socket);
    if (!userId) return;

    const postId = packet.readInt();
    await deleteReaction(postId, userId);

    const p = new Packet(PacketSC.REACTION_UPDATE);
    p.writeInt(postId);
    p.writeString(JSON.stringify({ userId, type: null }));
    broadcast(p.toBuffer());
}

// ─── Comment ─────────────────────────────────────────────────────────────────

async function recvCreateComment(socket: WS, packet: Packet): Promise<void> {
    const userId = requireAuth(socket);
    if (!userId) return;
    if (!checkRateLimit(userId, 'comment', 10, 60_000)) { sendError(socket, 'คอมเมนต์เร็วเกินไป กรุณารอสักครู่'); return; }

    const postId     = packet.readInt();
    const text       = packet.readString();
    const imageUrl   = packet.readString();
    const stickerUrl = packet.readString();
    const replyToId  = packet.readInt();

    const comment = await createComment({
        postId, userId,
        text:       sanitizeText(text) || undefined,
        imageUrl:   imageUrl   || undefined,
        stickerUrl: stickerUrl || undefined,
        replyToId:  replyToId > 0 ? replyToId : undefined,
    });

    let replyToName: string | undefined;
    if (replyToId > 0) {
        const parent = await prisma.comment.findUnique({
            where: { id: replyToId },
            include: { user: { select: { name: true } } },
        });
        replyToName = parent?.user.name;
    }

    const normalized = {
        ...comment,
        id: String(comment.id),
        user: { ...comment.user, id: String(comment.user.id) },
        replyTo: replyToId > 0 ? String(replyToId) : undefined,
        replyToId: undefined,
        replyToName,
    };

    // notify เจ้าของโพส
    const { getPostById } = await import('@/prisma/post');
    const post = await getPostById(postId);
    if (post && post.userId !== userId) {
        const notif = await upsertNotification({
            userId: post.userId,
            type: 'comment',
            fromName: comment.user.name,
            fromImage: comment.user.profileImage ?? undefined,
            fromId: userId,
            refId: postId,
            message: `แสดงความคิดเห็นในโพสของคุณ`,
        });
        const np = new Packet(PacketSC.NEW_NOTIFICATION);
        np.writeString(JSON.stringify(notif));
        sendToUser(post.userId, np.toBuffer());
    }

    const p = new Packet(PacketSC.NEW_COMMENT);
    p.writeInt(postId);
    p.writeString(JSON.stringify(normalized));
    broadcast(p.toBuffer());
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

async function recvSendMessage(socket: WS, packet: Packet): Promise<void> {
    const senderId = requireAuth(socket);
    if (!senderId) return;

    const receiverId = packet.readInt();
    const text = packet.readString();
    const fileUrl = packet.readString();
    const fileName = packet.readString();
    const fileType = packet.readString();

    const msg = await createMessage({
        senderId,
        receiverId,
        text: text || undefined,
        fileUrl: fileUrl || undefined,
        fileName: fileName || undefined,
        fileType: fileType || undefined,
    });

    const p = new Packet(PacketSC.NEW_MESSAGE);
    p.writeString(JSON.stringify({ ...msg, senderId: String(msg.senderId), sender: { ...msg.sender, id: String(msg.sender.id) } }));

    // ส่งให้ผู้รับ
    sendToUser(receiverId, p.toBuffer());
    // ส่งกลับผู้ส่งด้วย (echo)
    socket.send(p.toBuffer());

    // notification ถ้า receiver ไม่ได้ online
    const { getSocket } = await import('./session');
    if (!getSocket(receiverId)) {
        await createNotification({
            userId: receiverId,
            type: 'message',
            fromName: msg.sender.name,
            fromImage: msg.sender.profileImage ?? undefined,
            message: text ? text.slice(0, 50) : '📎 ส่งไฟล์มาให้คุณ',
        });
    }
}

async function recvGetConversation(socket: WS, packet: Packet): Promise<void> {
    const userId = requireAuth(socket);
    if (!userId) return;

    const friendId = packet.readInt();
    const offset = packet.readInt();
    const messages = await getConversation(userId, friendId, 10, offset);
    const normalized = messages.map(m => ({
        ...m,
        senderId: String(m.senderId),
        sender: { ...m.sender, id: String(m.sender.id) },
    }));

    const p = new Packet(PacketSC.MESSAGE_LIST);
    p.writeString(JSON.stringify(normalized));
    p.writeBool(messages.length === 10); // hasMore
    p.writeInt(offset);
    socket.send(p.toBuffer());
}

async function recvReadMessages(socket: WS, packet: Packet): Promise<void> {
    const userId = requireAuth(socket);
    if (!userId) return;

    const friendId = packet.readInt();
    await markMessagesRead(friendId, userId);

    // แจ้งผู้ส่งว่าถูกอ่านแล้ว
    const p = new Packet(PacketSC.MESSAGE_READ);
    p.writeInt(userId);
    sendToUser(friendId, p.toBuffer());
}

// ─── Notification ─────────────────────────────────────────────────────────────

async function recvGetNotifications(socket: WS, packet: Packet): Promise<void> {
    const userId = requireAuth(socket);
    if (!userId) return;

    const notifs = await getNotifications(userId);
    const p = new Packet(PacketSC.NOTIFICATION_LIST);
    p.writeString(JSON.stringify(notifs));
    socket.send(p.toBuffer());
}

async function recvMarkNotifRead(socket: WS, packet: Packet): Promise<void> {
    const userId = requireAuth(socket);
    if (!userId) return;

    const notifId = packet.readInt();
    await markNotificationRead(notifId);
}

async function recvMarkAllNotifRead(socket: WS, packet: Packet): Promise<void> {
    const userId = requireAuth(socket);
    if (!userId) return;

    await markAllNotificationsRead(userId);
}

// ─── Profile Image ────────────────────────────────────────────────────────────

async function recvUpdateProfileImage(socket: WS, packet: Packet): Promise<void> {
    const userId = requireAuth(socket);
    if (!userId) return;

    const imageUrl = packet.readString();
    if (!imageUrl) { sendError(socket, 'Missing imageUrl'); return; }

    await updateUser(userId, { profileImage: imageUrl });

    const p = new Packet(PacketSC.PROFILE_IMAGE_UPDATED);
    p.writeInt(userId);
    p.writeString(imageUrl);
    socket.send(p.toBuffer());
}

async function recvUpdateCoverImage(socket: WS, packet: Packet): Promise<void> {
    const userId = requireAuth(socket);
    if (!userId) return;

    const imageUrl = packet.readString();
    if (!imageUrl) { sendError(socket, 'Missing imageUrl'); return; }

    await updateUser(userId, { coverImage: imageUrl });

    const p = new Packet(PacketSC.COVER_IMAGE_UPDATED);
    p.writeInt(userId);
    p.writeString(imageUrl);
    socket.send(p.toBuffer());
}

async function recvUpdateProfile(socket: WS, packet: Packet): Promise<void> {
    const userId = requireAuth(socket);
    if (!userId) return;

    const name = packet.readString();
    const nickname = packet.readString();
    const bio = packet.readString();
    const province = packet.readString();
    const phone = packet.readString();

    const cleanName     = sanitizeShort(name, 50) || undefined;
    const cleanNickname = sanitizeShort(nickname, 50) || undefined;
    const cleanBio      = sanitizeText(bio) || undefined;
    const cleanProvince = sanitizeShort(province, 100) || undefined;
    const cleanPhone    = sanitizeShort(phone, 20) || undefined;

    await updateUser(userId, {
        name: cleanName,
        nickname: cleanNickname,
        bio: cleanBio,
        province: cleanProvince,
        phone: cleanPhone,
    });

    const p = new Packet(PacketSC.PROFILE_UPDATED);
    p.writeString(JSON.stringify({ name: cleanName, nickname: cleanNickname, bio: cleanBio, province: cleanProvince, phone: cleanPhone }));
    socket.send(p.toBuffer());
}

// ─── Friend ───────────────────────────────────────────────────────────────────

async function recvGetFriendStatus(socket: WS, packet: Packet): Promise<void> {
    const userId = requireAuth(socket);
    if (!userId) return;
    const targetId = packet.readInt();
    const status = await getFriendStatus(userId, targetId);
    const p = new Packet(PacketSC.FRIEND_STATUS);
    p.writeInt(targetId);
    p.writeString(status);
    socket.send(p.toBuffer());
}

async function recvSendFriendRequest(socket: WS, packet: Packet): Promise<void> {
    const userId = requireAuth(socket);
    if (!userId) return;
    const targetId = packet.readInt();
    await sendFriendRequest(userId, targetId);

    const { getUserById } = await import('@/prisma/user');
    const sender = await getUserById(userId);
    if (sender) {
        // บันทึก notification ลง DB
        const notif = await createNotification({
            userId: targetId,
            type: 'friend_request',
            fromName: sender.name,
            fromImage: sender.profileImage ?? undefined,
            fromId: userId,
            message: 'ส่งคำขอเป็นเพื่อนมาให้คุณ',
        });

        // push real-time ถ้า online
        const np = new Packet(PacketSC.NEW_NOTIFICATION);
        np.writeString(JSON.stringify(notif));
        sendToUser(targetId, np.toBuffer());

        // ส่ง FRIEND_REQUEST_RECV ด้วยเพื่อให้ update UI ฝั่งผู้รับ
        const rp = new Packet(PacketSC.FRIEND_REQUEST_RECV);
        rp.writeInt(userId);
        rp.writeString(sender.name);
        rp.writeString(sender.profileImage ?? '');
        sendToUser(targetId, rp.toBuffer());
    }

    // ตอบกลับผู้ส่ง
    const p = new Packet(PacketSC.FRIEND_STATUS);
    p.writeInt(targetId);
    p.writeString('pending_sent');
    socket.send(p.toBuffer());
}

async function recvAcceptFriendRequest(socket: WS, packet: Packet): Promise<void> {
    const userId = requireAuth(socket);
    if (!userId) return;
    const requesterId = packet.readInt();
    await acceptFriendRequest(userId, requesterId);

    // notify ผู้ส่ง request
    const np = new Packet(PacketSC.FRIEND_UPDATE);
    np.writeInt(userId);
    sendToUser(requesterId, np.toBuffer());

    const p = new Packet(PacketSC.FRIEND_STATUS);
    p.writeInt(requesterId);
    p.writeString('accepted');
    socket.send(p.toBuffer());
}

async function recvRemoveFriend(socket: WS, packet: Packet): Promise<void> {
    const userId = requireAuth(socket);
    if (!userId) return;
    const targetId = packet.readInt();
    await removeFriend(userId, targetId);

    const p = new Packet(PacketSC.FRIEND_STATUS);
    p.writeInt(targetId);
    p.writeString('none');
    socket.send(p.toBuffer());

    const np = new Packet(PacketSC.FRIEND_UPDATE);
    np.writeInt(userId);
    sendToUser(targetId, np.toBuffer());
}

async function recvGetFriends(socket: WS, _packet: Packet): Promise<void> {
    const userId = requireAuth(socket);
    if (!userId) return;
    const friends = await getFriends(userId);
    const p = new Packet(PacketSC.FRIEND_LIST);
    p.writeString(JSON.stringify(friends.map((f: any) => ({
        ...f, id: String(f.id),
        online: sessions.has(f.id),
    }))));
    socket.send(p.toBuffer());
}

async function recvGetFriendsPanel(socket: WS, _packet: Packet): Promise<void> {
    const userId = requireAuth(socket);
    if (!userId) return;
    const friends = await getFriends(userId);
    const p = new Packet(PacketSC.FRIEND_LIST_PANEL);
    p.writeString(JSON.stringify(friends.map((f: any) => ({
        ...f, id: String(f.id),
        online: sessions.has(f.id),
    }))));
    socket.send(p.toBuffer());
}

async function recvGetUserById(socket: WS, packet: Packet): Promise<void> {
    const targetId = packet.readInt();
    const user = await getUserById(targetId);
    if (!user) { sendError(socket, 'User not found'); return; }
    const p = new Packet(PacketSC.USER_DATA);
    p.writeString(JSON.stringify({
        id: String(user.id),
        name: user.name,
        nickname: user.nickname ?? '',
        bio: user.bio ?? '',
        province: user.province ?? '',
        phone: user.phone ?? '',
        profileImage: user.profileImage ?? '',
        coverImage: user.coverImage ?? '',
        createdAt: user.createdAt.toISOString(),
    }));
    socket.send(p.toBuffer());
}

async function recvSearchUsers(socket: WS, packet: Packet): Promise<void> {
    const query = packet.readString();
    if (!query || query.length < 2) return;
    const { searchUsers } = await import('@/prisma/user');
    const users = await searchUsers(query);
    const p = new Packet(PacketSC.SEARCH_RESULTS);
    p.writeString(JSON.stringify(users.map(u => ({
        id: String(u.id),
        name: u.name,
        nickname: u.nickname ?? '',
        profileImage: u.profileImage ?? '',
    }))));
    socket.send(p.toBuffer());
}

async function recvGetPendingRequests(socket: WS, _packet: Packet): Promise<void> {
    const userId = requireAuth(socket);
    if (!userId) return;
    const rows = await getPendingRequests(userId);
    const data = rows.map(r => ({ ...r.requester, id: String(r.requester.id) }));
    const p = new Packet(PacketSC.PENDING_REQUESTS);
    p.writeString(JSON.stringify(data));
    socket.send(p.toBuffer());
}

async function recvGetSentRequests(socket: WS, _packet: Packet): Promise<void> {
    const userId = requireAuth(socket);
    if (!userId) return;
    const rows = await getSentRequests(userId);
    const data = rows.map(r => ({ ...r.addressee, id: String(r.addressee.id) }));
    const p = new Packet(PacketSC.SENT_REQUESTS);
    p.writeString(JSON.stringify(data));
    socket.send(p.toBuffer());
}

/** accept=true → ยืนยัน, accept=false → ปฏิเสธ */
async function recvHandleFriendNotif(socket: WS, packet: Packet): Promise<void> {
    const userId = requireAuth(socket);
    if (!userId) return;

    const notifId = packet.readInt();
    const fromId = packet.readInt();
    const accepted = packet.readBool();

    // mark notification handled ใน DB
    await markNotificationHandled(notifId);

    if (accepted && fromId > 0) {
        await acceptFriendRequest(userId, fromId);

        // notify ผู้ส่ง request ว่าถูก accept
        const np = new Packet(PacketSC.FRIEND_UPDATE);
        np.writeInt(userId);
        sendToUser(fromId, np.toBuffer());
    } else if (!accepted && fromId > 0) {
        await removeFriend(userId, fromId);
    }
}

async function recvReportPost(socket: WS, packet: Packet): Promise<void> {
    const userId = requireAuth(socket);
    if (!userId) return;

    const postId = packet.readInt();
    const reason = packet.readString();

    await createReport({ postId, userId, reason });

    const p = new Packet(PacketSC.REPORT_OK);
    socket.send(p.toBuffer());
}

async function recvBookmarkPost(socket: WS, packet: Packet): Promise<void> {
    const userId = requireAuth(socket);
    if (!userId) return;
    const postId = packet.readInt();
    await addBookmark(userId, postId);
    const p = new Packet(PacketSC.BOOKMARK_UPDATE);
    p.writeInt(postId); p.writeBool(true);
    socket.send(p.toBuffer());
}

async function recvUnbookmarkPost(socket: WS, packet: Packet): Promise<void> {
    const userId = requireAuth(socket);
    if (!userId) return;
    const postId = packet.readInt();
    await removeBookmark(userId, postId);
    const p = new Packet(PacketSC.BOOKMARK_UPDATE);
    p.writeInt(postId); p.writeBool(false);
    socket.send(p.toBuffer());
}

async function recvGetBookmarks(socket: WS, packet: Packet): Promise<void> {
    const userId = requireAuth(socket);
    if (!userId) return;
    const offset = packet.readInt();
    const rows = await getBookmarks(userId, 10, offset);
    const posts = rows.map(r => normalizePostForApi(r.post));
    const p = new Packet(PacketSC.BOOKMARK_LIST);
    p.writeString(JSON.stringify(posts));
    p.writeBool(rows.length === 10);
    socket.send(p.toBuffer());
}

async function recvReactMessage(socket: WS, packet: Packet): Promise<void> {
    const userId = requireAuth(socket);
    if (!userId) return;
    const messageId = packet.readInt();
    const emoji = packet.readString();

    await prisma.messageReaction.upsert({
        where: { messageId_userId: { messageId, userId } },
        update: { emoji },
        create: { messageId, userId, emoji },
    });

    // ส่งให้ทั้งสองฝ่าย
    const msg = await prisma.message.findUnique({ where: { id: messageId }, select: { senderId: true, receiverId: true } });
    if (!msg) return;

    const p = new Packet(PacketSC.MESSAGE_REACTION_UPDATE);
    p.writeString(JSON.stringify({ messageId, userId, emoji }));
    sendToUser(msg.senderId, p.toBuffer());
    if (msg.receiverId !== msg.senderId) sendToUser(msg.receiverId, p.toBuffer());
}

async function recvUnreactMessage(socket: WS, packet: Packet): Promise<void> {
    const userId = requireAuth(socket);
    if (!userId) return;
    const messageId = packet.readInt();

    await prisma.messageReaction.deleteMany({ where: { messageId, userId } });

    const msg = await prisma.message.findUnique({ where: { id: messageId }, select: { senderId: true, receiverId: true } });
    if (!msg) return;

    const p = new Packet(PacketSC.MESSAGE_REACTION_UPDATE);
    p.writeString(JSON.stringify({ messageId, userId, emoji: null }));
    sendToUser(msg.senderId, p.toBuffer());
    if (msg.receiverId !== msg.senderId) sendToUser(msg.receiverId, p.toBuffer());
}

async function recvGetBookmarkIds(socket: WS, _packet: Packet): Promise<void> {
    const userId = requireAuth(socket);
    if (!userId) return;
    const rows = await prisma.bookmark.findMany({ where: { userId }, select: { postId: true } });
    const p = new Packet(PacketSC.BOOKMARK_IDS);
    p.writeString(JSON.stringify(rows.map(r => String(r.postId))));
    socket.send(p.toBuffer());
}
