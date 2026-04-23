import prisma from './client';

export async function addBookmark(userId: number, postId: number): Promise<void> {
    await prisma.bookmark.upsert({
        where: { userId_postId: { userId, postId } },
        update: {},
        create: { userId, postId },
    });
}

export async function removeBookmark(userId: number, postId: number): Promise<void> {
    await prisma.bookmark.deleteMany({ where: { userId, postId } });
}

export async function getBookmarks(userId: number, limit = 20, offset = 0) {
    return prisma.bookmark.findMany({
        where: { userId },
        include: { post: { include: {
            user: { select: { id: true, name: true, profileImage: true } },
            reactions: { include: { user: { select: { name: true } } } },
            comments: { include: { user: { select: { id: true, name: true, profileImage: true } }, replyToComment: { select: { user: { select: { name: true } } } } }, orderBy: { createdAt: 'asc' } },
            sharedFrom: { include: {
                user: { select: { id: true, name: true, profileImage: true } },
                reactions: { include: { user: { select: { name: true } } } },
                comments: { include: { user: { select: { id: true, name: true, profileImage: true } }, replyToComment: { select: { user: { select: { name: true } } } } }, orderBy: { createdAt: 'asc' } },
            }},
        }}},
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
    });
}

export async function isBookmarked(userId: number, postId: number): Promise<boolean> {
    const b = await prisma.bookmark.findUnique({ where: { userId_postId: { userId, postId } } });
    return !!b;
}
