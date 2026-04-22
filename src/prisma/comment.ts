import prisma from './client';
import type { Comment } from '@prisma/client';

export type CommentWithUser = Comment & {
    user: { id: number; name: string; profileImage: string | null };
    replyToUser?: { name: string } | null;
};

export async function createComment(data: {
    postId: number;
    userId: number;
    text?: string;
    imageUrl?: string;
    stickerUrl?: string;
    replyToId?: number;
}): Promise<CommentWithUser> {
    return prisma.comment.create({
        data,
        include: { user: { select: { id: true, name: true, profileImage: true } } },
    }) as Promise<CommentWithUser>;
}

export async function deleteComment(id: number, userId: number): Promise<void> {
    await prisma.comment.deleteMany({ where: { id, userId } });
}

export async function getCommentsByPost(postId: number): Promise<CommentWithUser[]> {
    return prisma.comment.findMany({
        where: { postId },
        include: { user: { select: { id: true, name: true, profileImage: true } } },
        orderBy: { createdAt: 'asc' },
    }) as Promise<CommentWithUser[]>;
}
