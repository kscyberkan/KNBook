import prisma from './client';

export async function upsertReaction(postId: number, userId: number, type: string): Promise<void> {
    await prisma.reaction.upsert({
        where: { postId_userId: { postId, userId } },
        update: { type },
        create: { postId, userId, type },
    });
}

export async function deleteReaction(postId: number, userId: number): Promise<void> {
    await prisma.reaction.deleteMany({ where: { postId, userId } });
}

export async function getReactionsByPost(postId: number) {
    return prisma.reaction.findMany({
        where: { postId },
        include: { user: { select: { name: true } } },
    });
}
