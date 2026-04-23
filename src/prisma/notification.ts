import prisma from './client';
import type { Notification } from '@prisma/client';

export async function createNotification(data: {
    userId: number;
    type: string;
    fromName: string;
    fromImage?: string;
    fromId?: number;
    refId?: number;
    message: string;
}): Promise<Notification> {
    return prisma.notification.create({ data });
}

/** upsert — ถ้ามี notification ของ type+refId+fromId อยู่แล้วให้ update message และ reset read แทน */
export async function upsertNotification(data: {
    userId: number;
    type: string;
    fromName: string;
    fromImage?: string;
    fromId?: number;
    refId?: number;
    message: string;
}): Promise<Notification> {
    if (data.fromId && data.refId) {
        const existing = await prisma.notification.findFirst({
            where: { userId: data.userId, type: data.type, fromId: data.fromId, refId: data.refId },
        });
        if (existing) {
            return prisma.notification.update({
                where: { id: existing.id },
                data: { message: data.message, fromName: data.fromName, fromImage: data.fromImage, read: false, createdAt: new Date() },
            });
        }
    }
    return prisma.notification.create({ data });
}

export async function getNotifications(userId: number, limit = 30): Promise<Notification[]> {
    return prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
    });
}

export async function markNotificationRead(id: number): Promise<void> {
    await prisma.notification.update({ where: { id }, data: { read: true } });
}

export async function markNotificationHandled(id: number): Promise<void> {
    await prisma.notification.update({ where: { id }, data: { read: true, handled: true } });
}

export async function markAllNotificationsRead(userId: number): Promise<void> {
    await prisma.notification.updateMany({ where: { userId }, data: { read: true } });
}

export async function getUnreadNotificationCount(userId: number): Promise<number> {
    return prisma.notification.count({ where: { userId, read: false } });
}
