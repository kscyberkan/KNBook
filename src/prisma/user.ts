import prisma from './client';
import type { User } from '@prisma/client';

export type UserData = User;

export async function getUserById(id: number): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
}

export async function getUserByUsername(username: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { username } });
}

export async function getUserByToken(token: string): Promise<User | null> {
    return prisma.user.findFirst({ where: { token } });
}

export async function createUser(data: {
    username: string;
    password: string;
    name: string;
    nickname?: string;
    profileImage?: string;
}): Promise<User> {
    return prisma.user.create({ data });
}

export async function updateUser(id: number, data: Partial<{
    name: string;
    nickname: string;
    bio: string;
    province: string;
    phone: string;
    profileImage: string;
    coverImage: string;
    token: string;
}>): Promise<User> {
    return prisma.user.update({ where: { id }, data });
}

export async function deleteUser(id: number): Promise<void> {
    await prisma.user.delete({ where: { id } });
}

export async function searchUsers(query: string): Promise<User[]> {
    return prisma.user.findMany({
        where: {
            OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { username: { contains: query, mode: 'insensitive' } },
                { nickname: { contains: query, mode: 'insensitive' } },
            ],
        },
        take: 20,
    });
}
