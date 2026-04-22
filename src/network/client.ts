import Packet from './packet';
import { PacketCS, PacketSC } from './packetList';

type Handler = (packet: Packet) => void;

class NetworkClient {
    private ws: WebSocket | null = null;
    private handlers = new Map<number, Handler[]>();
    private queue: Uint8Array[] = []; // packets รอส่งก่อน connect

    connect(token?: string): void {
        const proto = location.protocol === 'https:' ? 'wss' : 'ws';
        this.ws = new WebSocket(`${proto}://${location.host}/ws`);
        this.ws.binaryType = 'arraybuffer';

        this.ws.onopen = () => {
            if (token) {
                const p = new Packet(PacketCS.RESUME);
                p.writeString(token);
                this.ws!.send(p.toBuffer());
            } else {
                this.queue.forEach(buf => this.ws!.send(buf));
                this.queue = [];
            }
        };

        this.ws.onmessage = (e: MessageEvent) => {
            const buf = e.data instanceof ArrayBuffer
                ? new Uint8Array(e.data)
                : e.data instanceof Uint8Array
                ? e.data
                : new Uint8Array(0);
            const packet = new Packet(0);
            packet.forceCopyBuffer(buf);
            const id = packet.getPacketID();

            // RESUME_OK — session พร้อมแล้ว flush queue
            if (id === PacketSC.RESUME_OK) {
                this.queue.forEach(buf => this.ws!.send(buf));
                this.queue = [];
                this.handlers.get(PacketSC.RESUME_OK)?.forEach(h => h(packet));
                return;
            }

            // FORCE_LOGOUT
            if (id === PacketSC.FORCE_LOGOUT) {
                this.ws?.close();
                this.ws = null;
                this.handlers.get(PacketSC.FORCE_LOGOUT)?.forEach(h => h(packet));
                return;
            }

            this.handlers.get(id)?.forEach(h => {
                // สร้าง Packet ใหม่ต่อ handler เพื่อไม่ให้ readPos ชนกัน
                const fresh = new Packet(0);
                fresh.forceCopyBuffer(buf.slice());
                h(fresh);
            });
        };

        this.ws.onclose = () => {
            // reconnect หลัง 3 วิ พร้อม token เดิม
            setTimeout(() => this.connect(token), 3000);
        };
    }

    send(packet: Packet): void {
        const buf = packet.toBuffer();
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(buf);
        } else {
            this.queue.push(buf);
        }
    }

    on(packetId: number, handler: Handler): () => void {
        if (!this.handlers.has(packetId)) this.handlers.set(packetId, []);
        this.handlers.get(packetId)!.push(handler);
        // return unsubscribe fn
        return () => {
            const arr = this.handlers.get(packetId);
            if (arr) this.handlers.set(packetId, arr.filter(h => h !== handler));
        };
    }

    // ─── Auth ────────────────────────────────────────────────────────────────

    login(username: string, password: string): void {
        const p = new Packet(PacketCS.LOGIN);
        p.writeString(username);
        p.writeString(password);
        this.send(p);
    }

    register(username: string, password: string, name: string, nickname?: string, phone?: string, province?: string): void {
        const p = new Packet(PacketCS.REGISTER);
        p.writeString(username);
        p.writeString(password);
        p.writeString(name);
        p.writeString(nickname ?? '');
        p.writeString(phone ?? '');
        p.writeString(province ?? '');
        this.send(p);
    }

    logout(): void {
        this.send(new Packet(PacketCS.LOGOUT));
    }

    // ─── Feed ────────────────────────────────────────────────────────────────

    getFeed(offset = 0): void {
        const p = new Packet(PacketCS.GET_FEED);
        p.writeInt(offset);
        this.send(p);
    }

    getUserPosts(userId: number, offset = 0): void {
        const p = new Packet(PacketCS.GET_USER_POSTS);
        p.writeInt(userId);
        p.writeInt(offset);
        this.send(p);
    }

    async createPost(data: {
        text?: string;
        imageFile?: File | null;
        videoFile?: File | null;
        feeling?: string | null;
        stickerUrl?: string | null;
        sharedFromId?: number;
    }): Promise<void> {
        let imageUrl = '';
        let videoUrl = '';

        if (data.imageFile) imageUrl = await uploadFile(data.imageFile, 'post');
        if (data.videoFile) videoUrl = await uploadFile(data.videoFile, 'post');

        const p = new Packet(PacketCS.CREATE_POST);
        p.writeString(data.text ?? '');
        p.writeString(imageUrl);
        p.writeString(videoUrl);
        p.writeString(data.feeling ?? '');
        p.writeString(data.stickerUrl ?? '');
        p.writeInt(data.sharedFromId ?? 0);
        this.send(p);
    }

    deletePost(postId: number): void {
        const p = new Packet(PacketCS.DELETE_POST);
        p.writeInt(postId);
        this.send(p);
    }

    // ─── Reaction ────────────────────────────────────────────────────────────

    reactPost(postId: number, type: string): void {
        const p = new Packet(PacketCS.REACT_POST);
        p.writeInt(postId);
        p.writeString(type);
        this.send(p);
    }

    unreactPost(postId: number): void {
        const p = new Packet(PacketCS.UNREACT_POST);
        p.writeInt(postId);
        this.send(p);
    }

    // ─── Comment ─────────────────────────────────────────────────────────────

    createComment(postId: number, text: string, imageUrl?: string, stickerUrl?: string, replyToId?: number): void {
        const p = new Packet(PacketCS.CREATE_COMMENT);
        p.writeInt(postId);
        p.writeString(text);
        p.writeString(imageUrl ?? '');
        p.writeString(stickerUrl ?? '');
        p.writeInt(replyToId ?? 0);
        this.send(p);
    }

    // ─── Chat ─────────────────────────────────────────────────────────────────

    async sendMessage(receiverId: number, data: {
        text?: string;
        file?: File | null;
        fileType?: 'image' | 'video' | 'file';
    }): Promise<void> {
        let fileUrl = '';
        let fileName = '';

        if (data.file) {
            fileUrl  = await uploadFile(data.file, 'chat');
            fileName = data.file.name;
        }

        const p = new Packet(PacketCS.SEND_MESSAGE);
        p.writeInt(receiverId);
        p.writeString(data.text ?? '');
        p.writeString(fileUrl);
        p.writeString(fileName);
        p.writeString(data.fileType ?? '');
        this.send(p);
    }

    getConversation(friendId: number): void {
        const p = new Packet(PacketCS.GET_CONVERSATION);
        p.writeInt(friendId);
        this.send(p);
    }

    readMessages(friendId: number): void {
        const p = new Packet(PacketCS.READ_MESSAGES);
        p.writeInt(friendId);
        this.send(p);
    }

    // ─── Notification ─────────────────────────────────────────────────────────

    getNotifications(): void {
        this.send(new Packet(PacketCS.GET_NOTIFICATIONS));
    }

    markNotificationRead(id: number): void {
        const p = new Packet(PacketCS.MARK_NOTIFICATION_READ);
        p.writeInt(id);
        this.send(p);
    }

    markAllNotificationsRead(): void {
        this.send(new Packet(PacketCS.MARK_ALL_NOTIF_READ));
    }

    // ─── Friend ───────────────────────────────────────────────────────────────

    getFriendStatus(targetId: number): void {
        const p = new Packet(PacketCS.GET_FRIEND_STATUS);
        p.writeInt(targetId);
        this.send(p);
    }

    sendFriendRequest(targetId: number): void {
        const p = new Packet(PacketCS.SEND_FRIEND_REQUEST);
        p.writeInt(targetId);
        this.send(p);
    }

    acceptFriendRequest(requesterId: number): void {
        const p = new Packet(PacketCS.ACCEPT_FRIEND_REQUEST);
        p.writeInt(requesterId);
        this.send(p);
    }

    handleFriendNotif(notifId: number, fromId: number, accepted: boolean): void {
        const p = new Packet(PacketCS.HANDLE_FRIEND_NOTIF);
        p.writeInt(notifId);
        p.writeInt(fromId);
        p.writeBool(accepted);
        this.send(p);
    }

    removeFriend(targetId: number): void {
        const p = new Packet(PacketCS.REMOVE_FRIEND);
        p.writeInt(targetId);
        this.send(p);
    }

    getFriends(): void {
        this.send(new Packet(PacketCS.GET_FRIENDS));
    }

    getFriendsPanel(): void {
        this.send(new Packet(PacketCS.GET_FRIENDS_PANEL));
    }

    getPendingRequests(): void {
        this.send(new Packet(PacketCS.GET_PENDING_REQUESTS));
    }

    getSentRequests(): void {
        this.send(new Packet(PacketCS.GET_SENT_REQUESTS));
    }

    updateProfile(data: { name: string; nickname: string; bio: string; province: string; phone: string }): void {
        const p = new Packet(PacketCS.UPDATE_PROFILE);
        p.writeString(data.name);
        p.writeString(data.nickname);
        p.writeString(data.bio);
        p.writeString(data.province);
        p.writeString(data.phone);
        this.send(p);
    }

    // ─── Upload helpers ───────────────────────────────────────────────────────
    async uploadProfileImage(file: File, userId: string): Promise<string> {
        const url = await uploadFile(file, 'profile', userId);
        // บันทึกลง DB ผ่าน packet
        const p = new Packet(PacketCS.UPDATE_PROFILE_IMAGE);
        p.writeString(url);
        this.send(p);
        return url;
    }

    async uploadCoverImage(file: File, userId: string): Promise<string> {
        const url = await uploadFile(file, 'cover', userId);
        const p = new Packet(PacketCS.UPDATE_COVER_IMAGE);
        p.writeString(url);
        this.send(p);
        return url;
    }
}

// ─── Upload helper ────────────────────────────────────────────────────────────

async function uploadFile(
    file: File,
    source: 'post' | 'chat' | 'profile' | 'cover' = 'post',
    userId?: string
): Promise<string> {
    const form = new FormData();
    form.append('file', file);
    form.append('source', source);
    if (userId) form.append('userId', userId);
    const res = await fetch('/api/upload', { method: 'POST', body: form });
    const json = await res.json() as { url?: string; error?: string };
    if (!json.url) throw new Error(json.error ?? 'Upload failed');
    return json.url;
}

// singleton
const net = new NetworkClient();
export default net;
export { PacketSC };
