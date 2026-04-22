export interface User {
  id: string;
  name: string;
  profileImage: string;
  nickname?: string;
  bio?: string;
  province?: string;
  phone?: string;
  coverImage?: string;
  createdAt?: string;
}

export interface ReactionData {
  type: string;
  users: string[];
}

export interface Comment {
  id: string;
  user: User;
  text?: string;
  imageUrl?: string;
  stickerUrl?: string;
  replyTo?: string;       // id ของ comment ที่ตอบกลับ
  replyToName?: string;   // ชื่อคนที่ตอบกลับ (สำหรับ @mention)
  createdAt: string;
}

export interface Post {
  id: string;
  user: User;
  text?: string;
  imageUrl?: string;
  videoUrl?: string;
  feeling?: string;
  stickerUrl?: string;
  reactions: ReactionData[];
  comments?: Comment[];
  createdAt: string;
  sharedPost?: Post;
}
