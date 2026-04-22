import type { ServerWebSocket } from 'bun';
import { PacketSC } from './packetList';
import Packet from './packet';

export type WS = ServerWebSocket<{ userId?: number }>;

// userId → socket
const sessions = new Map<number, WS>();
// socket → userId
const socketUser = new Map<WS, number>();

export function registerSession(userId: number, socket: WS): void {
    const prev = sessions.get(userId);
    if (prev && prev !== socket) {
        // เตะ session เก่าออก — ส่ง FORCE_LOGOUT ก่อนปิด
        try {
            const p = new Packet(PacketSC.FORCE_LOGOUT);
            p.writeString('มีการเข้าสู่ระบบจากอุปกรณ์อื่น');
            prev.send(p.toBuffer());            prev.close();
        } catch { /* socket อาจปิดไปแล้ว */ }
        socketUser.delete(prev);
    }
    sessions.set(userId, socket);
    socketUser.set(socket, userId);
    socket.data.userId = userId;
}

export function removeSession(socket: WS): void {
    const userId = socketUser.get(socket);
    if (userId !== undefined) sessions.delete(userId);
    socketUser.delete(socket);
}

export function getUserId(socket: WS): number | undefined {
    return socketUser.get(socket);
}

export function getSocket(userId: number): WS | undefined {
    return sessions.get(userId);
}

export function sendToUser(userId: number, packet: Uint8Array): boolean {
    const sock = sessions.get(userId);
    if (sock) { sock.send(packet); return true; }
    return false;
}

export function broadcast(packet: Uint8Array, excludeSocket?: WS): void {
    sessions.forEach((sock) => {
        if (sock !== excludeSocket) sock.send(packet);
    });
}
