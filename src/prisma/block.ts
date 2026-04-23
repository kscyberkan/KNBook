import prisma from './client';

export async function blockUser(blockerId: number, blockedId: number): Promise<void> {
    await prisma.block.upsert({
        where: { blockerId_blockedId: { blockerId, blockedId } },
        update: {},
        create: { blockerId, blockedId },
    });
    // ลบ friendship ด้วย
    await prisma.friendship.deleteMany({
        where: {
            OR: [
                { requesterId: blockerId, addresseeId: blockedId },
                { requesterId: blockedId, addresseeId: blockerId },
            ],
        },
    });
}

export async function unblockUser(blockerId: number, blockedId: number): Promise<void> {
    await prisma.block.deleteMany({ where: { blockerId, blockedId } });
}

export async function getBlockedUsers(userId: number) {
    return prisma.block.findMany({
        where: { blockerId: userId },
        include: { blocked: { select: { id: true, name: true, profileImage: true } } },
    });
}

export async function isBlocked(blockerId: number, blockedId: number): Promise<boolean> {
    const b = await prisma.block.findUnique({ where: { blockerId_blockedId: { blockerId, blockedId } } });
    return !!b;
}
