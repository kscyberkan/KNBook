import prisma from './client';
import type { Message } from '@prisma/client';

export type MessageWithSender = Message & {
    sender: { id: number; name: string; profileImage: string | null };
    reactions: { userId: number; emoji: string }[];
};

export async function createMessage(data: {
    senderId: number;
    receiverId: number;
    text?: string;
    fileUrl?: string;
    fileName?: string;
    fileType?: string;
}): Promise<MessageWithSender> {
    return prisma.message.create({
        data,
        include: {
            sender: { select: { id: true, name: true, profileImage: true } },
            reactions: { select: { userId: true, emoji: true } },
        },
    }) as Promise<MessageWithSender>;
}

export async function getConversation(userAId: number, userBId: number, limit = 10, offset = 0): Promise<MessageWithSender[]> {
    const messages = await prisma.message.findMany({
        where: {
            OR: [
                { senderId: userAId, receiverId: userBId },
                { senderId: userBId, receiverId: userAId },
            ],
        },
        include: {
            sender: { select: { id: true, name: true, profileImage: true } },
            reactions: { select: { userId: true, emoji: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
    }) as Promise<MessageWithSender[]>;
    return (await messages).reverse();
}

export async function markMessagesRead(senderId: number, receiverId: number): Promise<void> {
    await prisma.message.updateMany({
        where: { senderId, receiverId, readAt: null },
        data: { readAt: new Date() },
    });
}

export async function getUnreadCount(userId: number): Promise<number> {
    return prisma.message.count({
        where: { receiverId: userId, readAt: null },
    });
}

export async function getUnreadPerSender(userId: number): Promise<{ senderId: number; count: number }[]> {
    const rows = await prisma.message.groupBy({
        by: ['senderId'],
        where: { receiverId: userId, readAt: null },
        _count: { id: true },
    });
    return rows.map(r => ({ senderId: r.senderId, count: r._count.id }));
}
