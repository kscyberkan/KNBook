import prisma from './client';

export type FriendStatus = 'none' | 'pending_sent' | 'pending_received' | 'accepted';

export async function getFriendStatus(userId: number, targetId: number): Promise<FriendStatus> {
    const f = await prisma.friendship.findFirst({
        where: {
            OR: [
                { requesterId: userId, addresseeId: targetId },
                { requesterId: targetId, addresseeId: userId },
            ],
        },
    });
    if (!f) return 'none';
    if (f.status === 'accepted') return 'accepted';
    if (f.requesterId === userId) return 'pending_sent';
    return 'pending_received';
}

export async function sendFriendRequest(requesterId: number, addresseeId: number): Promise<void> {
    await prisma.friendship.upsert({
        where: { requesterId_addresseeId: { requesterId, addresseeId } },
        update: { status: 'pending' },
        create: { requesterId, addresseeId, status: 'pending' },
    });
}

export async function acceptFriendRequest(userId: number, requesterId: number): Promise<void> {
    await prisma.friendship.updateMany({
        where: { requesterId, addresseeId: userId, status: 'pending' },
        data: { status: 'accepted' },
    });
}

export async function removeFriend(userId: number, targetId: number): Promise<void> {
    await prisma.friendship.deleteMany({
        where: {
            OR: [
                { requesterId: userId, addresseeId: targetId },
                { requesterId: targetId, addresseeId: userId },
            ],
        },
    });
}

export async function getFriends(userId: number) {
    const rows = await prisma.friendship.findMany({
        where: {
            status: 'accepted',
            OR: [{ requesterId: userId }, { addresseeId: userId }],
        },
        include: {
            requester: { select: { id: true, name: true, profileImage: true } },
            addressee: { select: { id: true, name: true, profileImage: true } },
        },
    });
    return rows.map(r => r.requesterId === userId ? r.addressee : r.requester);
}

export async function getPendingRequests(userId: number) {
    return prisma.friendship.findMany({
        where: { addresseeId: userId, status: 'pending' },
        include: { requester: { select: { id: true, name: true, profileImage: true } } },
    });
}

export async function getSentRequests(userId: number) {
    return prisma.friendship.findMany({
        where: { requesterId: userId, status: 'pending' },
        include: { addressee: { select: { id: true, name: true, profileImage: true } } },
    });
}
