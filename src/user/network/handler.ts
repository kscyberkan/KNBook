import Packet from './packet';
import { PacketCS, PacketSC } from './packetList';
import { registerSession, removeSession, getUserId, broadcast, sendToUser, sessions, type WS } from './session';
import { getUserByUsername, getUserByToken, createUser, updateUser, getUserById } from '@/prisma/user';
import { getFeedPosts, getPostsByUser, createPost, deletePost } from '@/prisma/post';
import { upsertReaction, deleteReaction } from '@/prisma/reaction';
import { createComment } from '@/prisma/comment';
import prisma from '@/prisma/client';
import { createMessage, getConversation, markMessagesRead, getUnreadPerSender } from '@/prisma/message';
import { createNotification, upsertNotification, getNotifications, markNotificationRead, markAllNotificationsRead, markNotificationHandled } from '@/prisma/notification';
import {
    createGroup, getGroupsByUser, getGroupById, updateGroupName, deleteGroup,
    addGroupMember, removeGroupMember, isGroupMember, isGroupAdmin,
    createGroupMessage, getGroupMessages, upsertGroupMessageReaction, deleteGroupMessageReaction,
} from '@/prisma/group';
import { createReport } from '@/prisma/report';
import { addBookmark, removeBookmark, getBookmarks } from '@/prisma/bookmark';
import { blockUser, unblockUser, getBlockedUsers } from '@/prisma/block';
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
    [PacketCS.DELETE_COMMENT, recvDeleteComment],
    [PacketCS.EDIT_POST, recvEditPost],
    [PacketCS.EDIT_COMMENT, recvEditComment],
    [PacketCS.BOOKMARK_POST, recvBookmarkPost],
    [PacketCS.UNBOOKMARK_POST, recvUnbookmarkPost],
    [PacketCS.GET_BOOKMARKS, recvGetBookmarks],
    [PacketCS.REACT_MESSAGE, recvReactMessage],
    [PacketCS.UNREACT_MESSAGE, recvUnreactMessage],
    [PacketCS.GET_BOOKMARK_IDS, recvGetBookmarkIds],
    [PacketCS.BLOCK_USER, recvBlockUser],
    [PacketCS.UNBLOCK_USER, recvUnblockUser],
    [PacketCS.GET_BLOCKED_USERS, recvGetBlockedUsers],
    [PacketCS.CALL_OFFER, recvCallOffer],
    [PacketCS.CALL_ANSWER, recvCallAnswer],
    [PacketCS.CALL_ICE, recvCallIce],
    [PacketCS.CALL_END, recvCallEnd],
    [PacketCS.GET_UNREAD_MESSAGES, recvGetUnreadMessages],
    [PacketCS.UPDATE_LANG,         recvUpdateLang],

    // Group Chat
    [PacketCS.CREATE_GROUP,          recvCreateGroup],
    [PacketCS.GET_MY_GROUPS,         recvGetMyGroups],
    [PacketCS.SEND_GROUP_MESSAGE,    recvSendGroupMessage],
    [PacketCS.GET_GROUP_MESSAGES,    recvGetGroupMessages],
    [PacketCS.ADD_GROUP_MEMBER,      recvAddGroupMember],
    [PacketCS.REMOVE_GROUP_MEMBER,   recvRemoveGroupMember],
    [PacketCS.LEAVE_GROUP,           recvLeaveGroup],
    [PacketCS.UPDATE_GROUP_NAME,     recvUpdateGroupName],
    [PacketCS.DELETE_GROUP,          recvDeleteGroup],
    [PacketCS.REACT_GROUP_MESSAGE,   recvReactGroupMessage],
    [PacketCS.UNREACT_GROUP_MESSAGE, recvUnreactGroupMessage],
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

    // rate limit: 10 ครั้ง/นาที ต่อ socket
    const socketId = (socket as any).remoteAddress ?? 'unknown';
    if (!checkRateLimit(socketId as any, 'login', 10, 60_000)) {
        const p = new Packet(PacketSC.REJECT_LOGIN);
        p.writeString('ลองใหม่อีกครั้งในภายหลัง');
        socket.send(p.toBuffer());
        return;
    }

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
    p.writeString((user as any).lang ?? 'th');
    socket.send(p.toBuffer());
}

async function recvRegister(socket: WS, packet: Packet): Promise<void> {
    const username = packet.readString();
    const password = packet.readString();
    const name = packet.readString();
    const nickname = packet.readString();
    const phone = packet.readString();
    const province = packet.readString();

    const socketId = (socket as any).remoteAddress ?? 'unknown';
    if (!checkRateLimit(socketId as any, 'register', 5, 60_000)) {
        const p = new Packet(PacketSC.REJECT_REGISTER);
        p.writeString('ลองใหม่อีกครั้งในภายหลัง');
        socket.send(p.toBuffer());
        return;
    }

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
    const userId = requireAuth(socket);
    if (!userId) return;
    const offset = packet.readInt();
    const posts = await getFeedPosts(userId, 10, offset);

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
    const groupName = packet.readString();
    const sharedFromId = packet.readInt();

    const post = await createPost({
        userId,
        text: sanitizeText(text) || undefined,
        imageUrl: imageUrl || undefined,
        videoUrl: videoUrl || undefined,
        feeling: sanitizeShort(feeling, 50) || undefined,
        stickerUrl: stickerUrl || undefined,
        groupName: sanitizeShort(groupName, 50) || undefined,
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

async function recvDeleteComment(socket: WS, packet: Packet): Promise<void> {
    const userId = requireAuth(socket);
    if (!userId) return;
    const commentId = packet.readInt();
    const comment = await prisma.comment.findUnique({ where: { id: commentId }, select: { userId: true, postId: true } });
    if (!comment || comment.userId !== userId) { sendError(socket, 'Unauthorized'); return; }
    await prisma.comment.delete({ where: { id: commentId } });
    const p = new Packet(PacketSC.COMMENT_DELETED);
    p.writeInt(comment.postId);
    p.writeInt(commentId);
    broadcast(p.toBuffer());
}

async function recvEditPost(socket: WS, packet: Packet): Promise<void> {
    const userId = requireAuth(socket);
    if (!userId) return;
    const postId = packet.readInt();
    const text = sanitizeText(packet.readString()) || undefined;
    const post = await prisma.post.findUnique({ where: { id: postId }, select: { userId: true } });
    if (!post || post.userId !== userId) { sendError(socket, 'Unauthorized'); return; }
    const updated = await prisma.post.update({ where: { id: postId }, data: { text } });
    const p = new Packet(PacketSC.POST_UPDATED);
    p.writeInt(postId);
    p.writeString(text ?? '');
    broadcast(p.toBuffer());
}

async function recvEditComment(socket: WS, packet: Packet): Promise<void> {
    const userId = requireAuth(socket);
    if (!userId) return;
    const commentId = packet.readInt();
    const text = sanitizeText(packet.readString()) || undefined;
    const comment = await prisma.comment.findUnique({ where: { id: commentId }, select: { userId: true, postId: true } });
    if (!comment || comment.userId !== userId) { sendError(socket, 'Unauthorized'); return; }
    await prisma.comment.update({ where: { id: commentId }, data: { text } });
    const p = new Packet(PacketSC.COMMENT_UPDATED);
    p.writeInt(comment.postId);
    p.writeInt(commentId);
    p.writeString(text ?? '');
    broadcast(p.toBuffer());
}

async function recvBlockUser(socket: WS, packet: Packet): Promise<void> {
    const userId = requireAuth(socket);
    if (!userId) return;
    const targetId = packet.readInt();
    if (targetId === userId) return;
    await blockUser(userId, targetId);
    const p = new Packet(PacketSC.BLOCK_UPDATE);
    p.writeInt(targetId); p.writeBool(true);
    socket.send(p.toBuffer());
}

async function recvUnblockUser(socket: WS, packet: Packet): Promise<void> {
    const userId = requireAuth(socket);
    if (!userId) return;
    const targetId = packet.readInt();
    await unblockUser(userId, targetId);
    const p = new Packet(PacketSC.BLOCK_UPDATE);
    p.writeInt(targetId); p.writeBool(false);
    socket.send(p.toBuffer());
}

async function recvGetBlockedUsers(socket: WS, _packet: Packet): Promise<void> {
    const userId = requireAuth(socket);
    if (!userId) return;
    const rows = await getBlockedUsers(userId);
    const p = new Packet(PacketSC.BLOCKED_LIST);
    p.writeString(JSON.stringify(rows.map(r => ({ id: String(r.blocked.id), name: r.blocked.name, profileImage: r.blocked.profileImage }))));
    socket.send(p.toBuffer());
}

// ─── WebRTC Signaling ─────────────────────────────────────────────────────────

async function recvCallOffer(socket: WS, packet: Packet): Promise<void> {
    const userId = requireAuth(socket);
    if (!userId) return;
    const targetId = packet.readInt();
    const callType = packet.readString(); // 'audio' | 'video'
    const sdp = packet.readString();

    const p = new Packet(PacketSC.CALL_INCOMING);
    p.writeInt(userId);
    p.writeString(callType);
    p.writeString(sdp);
    sendToUser(targetId, p.toBuffer());
}

async function recvCallAnswer(socket: WS, packet: Packet): Promise<void> {
    const userId = requireAuth(socket);
    if (!userId) return;
    const targetId = packet.readInt();
    const sdp = packet.readString();

    const p = new Packet(PacketSC.CALL_ANSWER);
    p.writeInt(userId);
    p.writeString(sdp);
    sendToUser(targetId, p.toBuffer());
}

async function recvCallIce(socket: WS, packet: Packet): Promise<void> {
    const userId = requireAuth(socket);
    if (!userId) return;
    const targetId = packet.readInt();
    const candidate = packet.readString();

    const p = new Packet(PacketSC.CALL_ICE);
    p.writeInt(userId);
    p.writeString(candidate);
    sendToUser(targetId, p.toBuffer());
}

async function recvCallEnd(socket: WS, packet: Packet): Promise<void> {
    const userId = requireAuth(socket);
    if (!userId) return;
    const targetId = packet.readInt();

    const p = new Packet(PacketSC.CALL_END);
    p.writeInt(userId);
    sendToUser(targetId, p.toBuffer());
}

async function recvGetUnreadMessages(socket: WS, _packet: Packet): Promise<void> {
    const userId = requireAuth(socket);
    if (!userId) return;
    const rows = await getUnreadPerSender(userId);
    const p = new Packet(PacketSC.UNREAD_MESSAGES);
    p.writeString(JSON.stringify(rows.map(r => ({ senderId: String(r.senderId), count: r.count }))));
    socket.send(p.toBuffer());
}

async function recvUpdateLang(socket: WS, packet: Packet): Promise<void> {
    const userId = requireAuth(socket);
    if (!userId) return;

    const lang = packet.readString();
    const allowed = ['th', 'en', 'cn', 'jp'];
    if (!allowed.includes(lang)) { sendError(socket, 'Invalid lang'); return; }

    await updateUser(userId, { lang } as any);

    const p = new Packet(PacketSC.LANG_UPDATED);
    p.writeString(lang);
    socket.send(p.toBuffer());
}

// ─── Group Chat ───────────────────────────────────────────────────────────────

function normalizeGroupMsg(m: any) {
    return {
        ...m,
        id: String(m.id),
        groupId: String(m.groupId),
        senderId: String(m.senderId),
        sender: { ...m.sender, id: String(m.sender.id) },
    };
}

async function broadcastToGroup(groupId: number, buf: Uint8Array, excludeUserId?: number): Promise<void> {
    const group = await getGroupById(groupId);
    if (!group) return;
    for (const member of group.members) {
        if (member.userId === excludeUserId) continue;
        sendToUser(member.userId, buf);
    }
}

async function recvCreateGroup(socket: WS, packet: Packet): Promise<void> {
    const userId = requireAuth(socket);
    if (!userId) return;

    const name = sanitizeShort(packet.readString(), 50);
    const memberIdsRaw = packet.readString();
    if (!name) { sendError(socket, 'Group name required'); return; }

    let memberIds: number[] = [];
    try { memberIds = JSON.parse(memberIdsRaw); } catch { memberIds = []; }

    const group = await createGroup(name, userId, memberIds);

    // ส่ง GROUP_CREATED ให้ทุก member
    const p = new Packet(PacketSC.GROUP_CREATED);
    p.writeString(JSON.stringify({
        ...group,
        id: String(group.id),
        members: group.members.map(m => ({ ...m, userId: String(m.userId), user: { ...m.user, id: String(m.user.id) } })),
    }));
    for (const member of group.members) {
        sendToUser(member.userId, p.toBuffer());
    }
}

async function recvGetMyGroups(socket: WS, _packet: Packet): Promise<void> {
    const userId = requireAuth(socket);
    if (!userId) return;

    const groups = await getGroupsByUser(userId);
    const p = new Packet(PacketSC.MY_GROUPS);
    p.writeString(JSON.stringify(groups.map(g => ({
        ...g,
        id: String(g.id),
        members: g.members.map(m => ({ ...m, userId: String(m.userId), user: { ...m.user, id: String(m.user.id) } })),
    }))));
    socket.send(p.toBuffer());
}

async function recvSendGroupMessage(socket: WS, packet: Packet): Promise<void> {
    const userId = requireAuth(socket);
    if (!userId) return;

    const groupId = packet.readInt();
    const text = packet.readString();
    const fileUrl = packet.readString();
    const fileName = packet.readString();
    const fileType = packet.readString();

    if (!await isGroupMember(groupId, userId)) { sendError(socket, 'Not a member'); return; }

    const msg = await createGroupMessage({
        groupId, senderId: userId,
        text: sanitizeText(text) || undefined,
        fileUrl: fileUrl || undefined,
        fileName: fileName || undefined,
        fileType: fileType || undefined,
    });

    const p = new Packet(PacketSC.NEW_GROUP_MESSAGE);
    p.writeString(JSON.stringify(normalizeGroupMsg(msg)));
    await broadcastToGroup(groupId, p.toBuffer());
}

async function recvGetGroupMessages(socket: WS, packet: Packet): Promise<void> {
    const userId = requireAuth(socket);
    if (!userId) return;

    const groupId = packet.readInt();
    const offset = packet.readInt();

    if (!await isGroupMember(groupId, userId)) { sendError(socket, 'Not a member'); return; }

    const msgs = await getGroupMessages(groupId, 20, offset);
    const p = new Packet(PacketSC.GROUP_MESSAGE_LIST);
    p.writeString(JSON.stringify(msgs.map(normalizeGroupMsg)));
    p.writeBool(msgs.length === 20);
    p.writeInt(offset);
    p.writeInt(groupId);
    socket.send(p.toBuffer());
}

async function recvAddGroupMember(socket: WS, packet: Packet): Promise<void> {
    const userId = requireAuth(socket);
    if (!userId) return;

    const groupId = packet.readInt();
    const targetId = packet.readInt();

    if (!await isGroupAdmin(groupId, userId)) { sendError(socket, 'Not admin'); return; }

    await addGroupMember(groupId, targetId);

    const group = await getGroupById(groupId);
    if (!group) return;

    // system message
    const { getUserById: getUser } = await import('@/prisma/user');
    const adder = await getUser(userId);
    const added = await getUser(targetId);
    if (adder && added) {
        const sysMsg = await createGroupMessage({ groupId, senderId: userId, text: `${adder.name} เพิ่ม ${added.name} เข้ากลุ่ม`, isSystem: true });
        const sp = new Packet(PacketSC.NEW_GROUP_MESSAGE);
        sp.writeString(JSON.stringify(normalizeGroupMsg(sysMsg)));
        await broadcastToGroup(groupId, sp.toBuffer());
    }

    const p = new Packet(PacketSC.GROUP_MEMBER_UPDATE);
    p.writeString(JSON.stringify({
        groupId: String(groupId),
        members: group.members.map(m => ({ ...m, userId: String(m.userId), user: { ...m.user, id: String(m.user.id) } })),
    }));
    await broadcastToGroup(groupId, p.toBuffer());
}

async function recvRemoveGroupMember(socket: WS, packet: Packet): Promise<void> {
    const userId = requireAuth(socket);
    if (!userId) return;

    const groupId = packet.readInt();
    const targetId = packet.readInt();

    if (!await isGroupAdmin(groupId, userId)) { sendError(socket, 'Not admin'); return; }

    await removeGroupMember(groupId, targetId);

    const group = await getGroupById(groupId);
    if (!group) return;

    const p = new Packet(PacketSC.GROUP_MEMBER_UPDATE);
    p.writeString(JSON.stringify({
        groupId: String(groupId),
        members: group.members.map(m => ({ ...m, userId: String(m.userId), user: { ...m.user, id: String(m.user.id) } })),
        removedUserId: String(targetId),
    }));
    await broadcastToGroup(groupId, p.toBuffer());
    // แจ้งคนที่ถูกเอาออก
    sendToUser(targetId, p.toBuffer());
}

async function recvLeaveGroup(socket: WS, packet: Packet): Promise<void> {
    const userId = requireAuth(socket);
    if (!userId) return;

    const groupId = packet.readInt();
    if (!await isGroupMember(groupId, userId)) return;

    const { getUserById: getUser } = await import('@/prisma/user');
    const user = await getUser(userId);

    await removeGroupMember(groupId, userId);

    const group = await getGroupById(groupId);

    if (user && group) {
        const sysMsg = await createGroupMessage({ groupId, senderId: userId, text: `${user.name} ออกจากกลุ่ม`, isSystem: true });
        const sp = new Packet(PacketSC.NEW_GROUP_MESSAGE);
        sp.writeString(JSON.stringify(normalizeGroupMsg(sysMsg)));
        await broadcastToGroup(groupId, sp.toBuffer());

        const p = new Packet(PacketSC.GROUP_MEMBER_UPDATE);
        p.writeString(JSON.stringify({
            groupId: String(groupId),
            members: group.members.map(m => ({ ...m, userId: String(m.userId), user: { ...m.user, id: String(m.user.id) } })),
            removedUserId: String(userId),
        }));
        await broadcastToGroup(groupId, p.toBuffer());
    }
}

async function recvUpdateGroupName(socket: WS, packet: Packet): Promise<void> {
    const userId = requireAuth(socket);
    if (!userId) return;

    const groupId = packet.readInt();
    const name = sanitizeShort(packet.readString(), 50);
    if (!name) { sendError(socket, 'Name required'); return; }
    if (!await isGroupAdmin(groupId, userId)) { sendError(socket, 'Not admin'); return; }

    await updateGroupName(groupId, name);

    const p = new Packet(PacketSC.GROUP_UPDATED);
    p.writeString(JSON.stringify({ groupId: String(groupId), name }));
    await broadcastToGroup(groupId, p.toBuffer());
}

async function recvDeleteGroup(socket: WS, packet: Packet): Promise<void> {
    const userId = requireAuth(socket);
    if (!userId) return;

    const groupId = packet.readInt();
    const group = await getGroupById(groupId);
    if (!group) return;
    if (group.createdById !== userId) { sendError(socket, 'Not owner'); return; }

    const memberIds = group.members.map(m => m.userId);
    await deleteGroup(groupId);

    const p = new Packet(PacketSC.GROUP_DELETED);
    p.writeString(JSON.stringify({ groupId: String(groupId) }));
    for (const mid of memberIds) sendToUser(mid, p.toBuffer());
}

async function recvReactGroupMessage(socket: WS, packet: Packet): Promise<void> {
    const userId = requireAuth(socket);
    if (!userId) return;

    const messageId = packet.readInt();
    const emoji = packet.readString();
    const groupId = packet.readInt();

    await upsertGroupMessageReaction(messageId, userId, emoji);

    const p = new Packet(PacketSC.GROUP_REACTION_UPDATE);
    p.writeString(JSON.stringify({ messageId: String(messageId), userId, emoji, groupId: String(groupId) }));
    await broadcastToGroup(groupId, p.toBuffer());
}

async function recvUnreactGroupMessage(socket: WS, packet: Packet): Promise<void> {
    const userId = requireAuth(socket);
    if (!userId) return;

    const messageId = packet.readInt();
    const groupId = packet.readInt();

    await deleteGroupMessageReaction(messageId, userId);

    const p = new Packet(PacketSC.GROUP_REACTION_UPDATE);
    p.writeString(JSON.stringify({ messageId: String(messageId), userId, emoji: null, groupId: String(groupId) }));
    await broadcastToGroup(groupId, p.toBuffer());
}
