import prisma from './client';

export async function createReport(data: {
    postId: number;
    userId: number;
    reason: string;
}): Promise<void> {
    await prisma.report.upsert({
        where: { postId_userId: { postId: data.postId, userId: data.userId } },
        update: { reason: data.reason },
        create: data,
    });
}
