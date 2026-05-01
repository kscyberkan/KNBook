import prisma from './client';

// ── Types ─────────────────────────────────────────────────────────────────────

export type GroupWithMembers = {
  id: number;
  name: string;
  imageUrl: string | null;
  createdById: number;
  createdAt: Date;
  members: { userId: number; role: string; user: { id: number; name: string; profileImage: string | null } }[];
};

export type GroupMessageWithSender = {
  id: number;
  groupId: number;
  senderId: number;
  text: string | null;
  fileUrl: string | null;
  fileName: string | null;
  fileType: string | null;
  isSystem: boolean;
  createdAt: Date;
  sender: { id: number; name: string; profileImage: string | null };
  reactions: { userId: number; emoji: string }[];
};

// ── Group CRUD ────────────────────────────────────────────────────────────────

export async function createGroup(name: string, createdById: number, memberIds: number[]): Promise<GroupWithMembers> {
  const group = await prisma.groupChat.create({
    data: {
      name,
      createdById,
      members: {
        create: [
          { userId: createdById, role: 'admin' },
          ...memberIds.filter(id => id !== createdById).map(id => ({ userId: id, role: 'member' })),
        ],
      },
    },
    include: {
      members: { include: { user: { select: { id: true, name: true, profileImage: true } } } },
    },
  });
  return group as GroupWithMembers;
}

export async function getGroupsByUser(userId: number): Promise<GroupWithMembers[]> {
  const memberships = await prisma.groupMember.findMany({
    where: { userId },
    include: {
      group: {
        include: {
          members: { include: { user: { select: { id: true, name: true, profileImage: true } } } },
        },
      },
    },
    orderBy: { group: { updatedAt: 'desc' } },
  });
  return memberships.map(m => m.group) as GroupWithMembers[];
}

export async function getGroupById(groupId: number): Promise<GroupWithMembers | null> {
  return prisma.groupChat.findUnique({
    where: { id: groupId },
    include: {
      members: { include: { user: { select: { id: true, name: true, profileImage: true } } } },
    },
  }) as Promise<GroupWithMembers | null>;
}

export async function updateGroupName(groupId: number, name: string): Promise<void> {
  await prisma.groupChat.update({ where: { id: groupId }, data: { name, updatedAt: new Date() } });
}

export async function deleteGroup(groupId: number): Promise<void> {
  await prisma.groupChat.delete({ where: { id: groupId } });
}

// ── Members ───────────────────────────────────────────────────────────────────

export async function addGroupMember(groupId: number, userId: number): Promise<void> {
  await prisma.groupMember.upsert({
    where: { groupId_userId: { groupId, userId } },
    create: { groupId, userId, role: 'member' },
    update: {},
  });
  await prisma.groupChat.update({ where: { id: groupId }, data: { updatedAt: new Date() } });
}

export async function removeGroupMember(groupId: number, userId: number): Promise<void> {
  await prisma.groupMember.delete({ where: { groupId_userId: { groupId, userId } } });
}

export async function isGroupMember(groupId: number, userId: number): Promise<boolean> {
  const m = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } } });
  return !!m;
}

export async function isGroupAdmin(groupId: number, userId: number): Promise<boolean> {
  const m = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } } });
  return m?.role === 'admin';
}

// ── Messages ──────────────────────────────────────────────────────────────────

export async function createGroupMessage(data: {
  groupId: number;
  senderId: number;
  text?: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  isSystem?: boolean;
}): Promise<GroupMessageWithSender> {
  const msg = await prisma.groupMessage.create({
    data,
    include: {
      sender: { select: { id: true, name: true, profileImage: true } },
      reactions: { select: { userId: true, emoji: true } },
    },
  });
  // bump group updatedAt for sorting
  await prisma.groupChat.update({ where: { id: data.groupId }, data: { updatedAt: new Date() } });
  return msg as GroupMessageWithSender;
}

export async function getGroupMessages(groupId: number, limit = 20, offset = 0): Promise<GroupMessageWithSender[]> {
  const msgs = await prisma.groupMessage.findMany({
    where: { groupId },
    include: {
      sender: { select: { id: true, name: true, profileImage: true } },
      reactions: { select: { userId: true, emoji: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
  });
  return (msgs as GroupMessageWithSender[]).reverse();
}

export async function upsertGroupMessageReaction(messageId: number, userId: number, emoji: string): Promise<void> {
  await prisma.groupMessageReaction.upsert({
    where: { messageId_userId: { messageId, userId } },
    create: { messageId, userId, emoji },
    update: { emoji },
  });
}

export async function deleteGroupMessageReaction(messageId: number, userId: number): Promise<void> {
  await prisma.groupMessageReaction.deleteMany({ where: { messageId, userId } });
}
