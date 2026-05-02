# KN Book

แพลตฟอร์ม Social Media แบบ Full-stack ที่รองรับ Real-time messaging, Video/Audio calls, Group chat, Notifications และ Admin panel รองรับ 4 ภาษา (ไทย, อังกฤษ, จีน, ญี่ปุ่น) ด้วย kiro AI

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | [Bun](https://bun.sh) |
| Frontend | React 19, TypeScript, Tailwind CSS 4 |
| Animation | Framer Motion |
| Icons | Lucide React |
| Database | PostgreSQL + Prisma 7 (pg adapter) |
| Real-time | Binary WebSocket protocol (custom) |
| Auth | Username/Password, Google OAuth, LINE LIFF |
| i18n | CSV-based dictionary |

---

## Quick Start

### 1. ติดตั้ง dependencies

```bash
bun install
```

### 2. ตั้งค่า environment variables

```bash
cp .env.example .env
```

แก้ไข `.env`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/knbook?schema=public"
NODE_ENV="development"
ADMIN_TOKEN="your-secret-admin-token"
```

### 3. Migrate database

```bash
bunx prisma migrate dev
```

### 4. รัน development server

```bash
bun dev        # hot reload
bun start      # production
bun run build  # build to dist/
```

---

## Project Structure

```
src/
├── index.ts                  # Entry point — Bun server, routes, WebSocket
├── types.ts                  # Shared TypeScript types (User, Post, Comment, ...)
├── storage.config.ts         # Media file path resolver
│
├── user/                     # User-facing SPA
│   ├── main.tsx              # React entry point
│   ├── index.html            # HTML shell
│   ├── Global.ts             # Global state (current user)
│   │
│   ├── auth/                 # Authentication
│   │   ├── login/            # Login page
│   │   ├── register/         # Register page
│   │   ├── google-auth.ts    # Google OAuth flow
│   │   └── line-auth.ts      # LINE LIFF flow
│   │
│   ├── pages/
│   │   ├── PageManager.tsx   # Main router + navbar + notification center
│   │   ├── Feed.tsx          # Feed page with filter/infinite scroll
│   │   ├── Profile.tsx       # User profile page
│   │   ├── EditProfile.tsx   # Edit profile form
│   │   └── Bookmarks.tsx     # Saved posts page
│   │
│   ├── components/
│   │   ├── FeedItem.tsx      # Post card (reactions, comments, share)
│   │   ├── CreatePost.tsx    # Post composer
│   │   ├── ChatWindow.tsx    # 1-on-1 chat window
│   │   ├── GroupChatWindow.tsx # Group chat window
│   │   ├── CallWindow.tsx    # WebRTC audio/video call UI
│   │   ├── FriendsPanel.tsx  # Friends management panel
│   │   ├── PostModal.tsx     # Post detail modal
│   │   ├── CommentInput.tsx  # Comment input with @mention
│   │   ├── SearchBox.tsx     # User search
│   │   ├── Avatar.tsx        # User avatar component
│   │   ├── VideoPlayer.tsx   # Video playback
│   │   ├── CreateGroupModal.tsx # Create group chat modal
│   │   └── emoji/            # Emoji picker, text renderer, mention input
│   │
│   └── network/
│       ├── client.ts         # WebSocket client + packet send helpers
│       ├── handler.ts        # Server-side packet handlers (all business logic)
│       ├── packet.ts         # Binary packet read/write
│       ├── packetList.ts     # Packet opcode enums (CS/SC)
│       ├── session.ts        # WebSocket session registry
│       ├── upload.ts         # File upload handler (/api/upload)
│       └── rateLimit.ts      # Per-user rate limiting
│
├── admin/                    # Admin SPA
│   ├── main.tsx
│   ├── index.html
│   ├── api.ts                # Admin REST API handlers
│   └── pages/
│       ├── AdminDashboard.tsx  # Layout + sidebar
│       ├── AdminLogin.tsx      # Token-based login
│       ├── StatsPage.tsx       # Realtime stats + charts
│       ├── UsersPage.tsx       # User list, ban/unban
│       ├── PostsPage.tsx       # Post list, delete/restore
│       ├── ReportsPage.tsx     # Report queue
│       └── AuditLogPage.tsx    # Admin action history
│
├── prisma/                   # Database query helpers
│   ├── client.ts             # Prisma client singleton
│   ├── user.ts               # User CRUD
│   ├── post.ts               # Post CRUD + feed query
│   ├── comment.ts            # Comment CRUD
│   ├── reaction.ts           # Post reactions
│   ├── message.ts            # Direct messages
│   ├── notification.ts       # Notifications
│   ├── friendship.ts         # Friend requests + status
│   ├── bookmark.ts           # Bookmarks
│   ├── block.ts              # User blocking
│   ├── group.ts              # Group chat CRUD + messages
│   └── report.ts             # Post reports
│
└── utils/
    ├── dictionary.tsx        # i18n hook + provider + LangSelector
    ├── defaultAvatar.ts      # Auto-generate SVG avatar
    └── sanitize.ts           # Input sanitization

prisma/
└── schema.prisma             # Database schema

public/
└── Dictionary.csv            # Translation strings (th/en/cn/jp)
```

---

## Features

### Authentication
**ไฟล์:** `src/user/auth/`

- Login/Register ด้วย username + password (bcrypt)
- **Google OAuth** — `google-auth.ts`, `google-config.ts`
- **LINE LIFF** — `line-auth.ts`, `line-config.ts`
- Session resume ด้วย token หลัง reconnect (packet `RESUME`)
- Auto-generate default avatar เมื่อสมัครใหม่ — `src/utils/defaultAvatar.ts`

---

### Feed & Posts
**ไฟล์:** `src/user/pages/Feed.tsx`, `src/user/components/CreatePost.tsx`, `src/user/components/FeedItem.tsx`

- Infinite scroll feed พร้อม Intersection Observer
- Real-time: โพสต์ใหม่โผล่ทันทีผ่าน `NEW_POST` broadcast
- **สร้างโพสต์** ได้ทั้ง: ข้อความ, รูปภาพ, วิดีโอ, สติกเกอร์, ความรู้สึก (feeling), tag กลุ่ม
- **แชร์โพสต์** ต่อได้ (shared post chain ไม่จำกัดชั้น)
- แก้ไข/ลบโพสต์ตัวเอง (soft delete)
- **Filter feed** ด้วย dropdown: ทั้งหมด / ทั่วไป / จากกลุ่ม (พร้อม searchbox กรองชื่อกลุ่ม)
- รายงานโพสต์ได้

---

### Reactions
**ไฟล์:** `src/user/components/FeedItem.tsx`, `src/prisma/reaction.ts`

- 6 ประเภท: ถูกใจ, รัก, ฮ่าๆ, เฉยๆ, เศร้า, โกรธ
- Hover เพื่อเลือก reaction บน desktop
- แสดง popup รายชื่อคนที่ react
- Real-time update ผ่าน `REACTION_UPDATE` broadcast

---

### Comments
**ไฟล์:** `src/user/components/FeedItem.tsx`, `src/user/components/CommentInput.tsx`

- Nested threads (comment → reply)
- @mention ผู้ใช้ใน comment
- แนบรูปภาพหรือสติกเกอร์ใน comment
- แก้ไข/ลบ comment ตัวเอง
- Real-time ผ่าน `NEW_COMMENT` / `COMMENT_DELETED` / `COMMENT_UPDATED`

---

### Bookmarks
**ไฟล์:** `src/user/pages/Bookmarks.tsx`, `src/prisma/bookmark.ts`

- บันทึกโพสต์ไว้ดูทีหลัง (กด 🔖 บน FeedItem)
- หน้า Bookmarks แยกต่างหาก พร้อม infinite scroll
- Sync สถานะ bookmark แบบ real-time ผ่าน `BOOKMARK_UPDATE`

---

### Friends
**ไฟล์:** `src/user/components/FriendsPanel.tsx`, `src/prisma/friendship.ts`

- ส่ง/รับ/ปฏิเสธ/ยกเลิก friend request
- ลบเพื่อน
- แสดงสถานะ online/offline แบบ real-time
- Panel มี 3 tab: เพื่อน / คำขอที่รอ / คำขอที่ส่งไป
- **Block user** — ซ่อนโพสต์และป้องกันการติดต่อ (`src/prisma/block.ts`)

---

### Direct Messaging (1-on-1 Chat)
**ไฟล์:** `src/user/components/ChatWindow.tsx`, `src/prisma/message.ts`

- Real-time chat ผ่าน WebSocket
- ส่งได้: ข้อความ, รูปภาพ, วิดีโอ, ไฟล์
- Emoji reactions บนข้อความ
- Read receipts (✓✓)
- Infinite scroll โหลดข้อความเก่า
- Unread message counter บน navbar
- Lightbox สำหรับดูรูป/วิดีโอ

---

### Group Chat
**ไฟล์:** `src/user/components/GroupChatWindow.tsx`, `src/user/components/CreateGroupModal.tsx`, `src/prisma/group.ts`

- สร้างกลุ่มพร้อมเลือกสมาชิก
- ส่งข้อความ, รูป, วิดีโอ, ไฟล์
- Emoji reactions บนข้อความกลุ่ม
- Admin สามารถ: เพิ่ม/ลบสมาชิก, เปลี่ยนชื่อกลุ่ม, ลบกลุ่ม
- สมาชิกออกจากกลุ่มได้
- System messages แจ้งเมื่อมีการเปลี่ยนแปลงสมาชิก

---

### Audio/Video Calls
**ไฟล์:** `src/user/components/CallWindow.tsx`

- WebRTC peer-to-peer (audio และ video)
- ICE servers: STUN (Google) + TURN (openrelay.metered.ca)
- Signaling ผ่าน WebSocket (`CALL_OFFER`, `CALL_ANSWER`, `CALL_ICE`, `CALL_END`)
- Toggle mic/camera ระหว่างสาย
- นับเวลาสาย
- Incoming call modal พร้อมปุ่มรับ/วาง

---

### Notifications
**ไฟล์:** `src/user/pages/PageManager.tsx`, `src/prisma/notification.ts`

- Real-time push ผ่าน `NEW_NOTIFICATION`
- ประเภท: โพสต์, reaction, comment, ข้อความ, friend request
- Grouped notifications (หลายคน react/comment โพสต์เดียวกัน → รวมเป็นอันเดียว)
- Mark as read / Mark all as read
- Badge แสดงจำนวนที่ยังไม่อ่าน

---

### Profile
**ไฟล์:** `src/user/pages/Profile.tsx`, `src/user/pages/EditProfile.tsx`

- รูปโปรไฟล์ + รูปหน้าปก (อัปโหลดได้)
- ข้อมูล: ชื่อ, ชื่อเล่น, bio, จังหวัด, เบอร์โทร
- ดูโพสต์ของผู้ใช้ (infinite scroll)
- แสดงสถานะเพื่อน + ปุ่ม Add Friend / Block

---

### Admin Panel
**ไฟล์:** `src/admin/`  
เข้าถึงที่ `/admin` — ต้องใช้ `ADMIN_TOKEN`

| หน้า | ไฟล์ | ฟีเจอร์ |
|---|---|---|
| Overview | `StatsPage.tsx` | จำนวน user/post/comment, กราฟ realtime online users, activity 7 วัน |
| Users | `UsersPage.tsx` | ค้นหา, ดูข้อมูล, ban/unban |
| Posts | `PostsPage.tsx` | ดูโพสต์ทั้งหมด, ลบ/กู้คืน, ดูรายละเอียด |
| Reports | `ReportsPage.tsx` | คิวรายงาน, ลบโพสต์หรือ dismiss |
| Audit Log | `AuditLogPage.tsx` | ประวัติการกระทำของ admin ทั้งหมด |

---

### i18n (Internationalization)
**ไฟล์:** `src/utils/dictionary.tsx`, `public/Dictionary.csv`

- รองรับ 4 ภาษา: 🇹🇭 ไทย, 🇺🇸 English, 🇨🇳 中文, 🇯🇵 日本語
- Translation strings อยู่ใน `public/Dictionary.csv` (key, th, en, cn, jp)
- Server parse CSV → JSON ส่งผ่าน `/api/dictionary`
- ใช้งานผ่าน hook: `const { t, tp } = useDictionary()`
- บันทึกภาษาที่เลือกใน localStorage และ sync กับ server

```tsx
// ตัวอย่างการใช้
const { t, tp } = useDictionary();
t('nav.home')                          // "หน้าแรก" | "Home" | ...
tp('feed.allPostsCount', { n: 42 })    // "— โพสต์ทั้งหมด 42 รายการ —"
```

---

### File Upload
**ไฟล์:** `src/user/network/upload.ts`, `src/storage.config.ts`

- Endpoint: `POST /api/upload`
- Media เสิร์ฟที่ `/media/*`
- โครงสร้างโฟลเดอร์:
  ```
  pictures/
  ├── posts/          # รูปในโพสต์
  ├── chat/           # รูปในแชท
  └── users/{id}/     # รูปโปรไฟล์/หน้าปก
  videos/
  ├── posts/          # วิดีโอในโพสต์
  └── chat/           # วิดีโอในแชท
  ```

---

## WebSocket Protocol

**ไฟล์:** `src/user/network/packetList.ts`, `src/user/network/packet.ts`

การสื่อสารทั้งหมดใช้ binary packet ผ่าน WebSocket ที่ `/ws`

```
[2 bytes: opcode] [payload bytes...]
```

Packet เขียน/อ่านด้วย `Packet` class — รองรับ `readInt()`, `readString()`, `readBool()` ฯลฯ

กลุ่ม opcode หลัก (Client → Server / Server → Client):

| กลุ่ม | Opcode range |
|---|---|
| Auth | 1–5 |
| Post | 10–14 |
| Reaction | 20–21 |
| Comment | 30–32 |
| Chat | 40–42 |
| Notification | 50–52 |
| Profile | 60–62 |
| Friend | 70–80 |
| Report/Bookmark/Block | 90–99 |
| WebRTC | 100–104 |
| Group Chat | 110–120 |

---

## Database Schema

**ไฟล์:** `prisma/schema.prisma`

```
User ──┬── Post ──┬── Reaction
       │          ├── Comment (self-relation for replies)
       │          ├── Bookmark
       │          └── Report
       │
       ├── Message (sender/receiver)
       ├── Notification
       ├── Friendship (requester/addressee)
       ├── Block (blocker/blocked)
       └── GroupChat ──┬── GroupMember
                       └── GroupMessage ── GroupMessageReaction
```

---

## Server Routes

**ไฟล์:** `src/index.ts`

| Route | คำอธิบาย |
|---|---|
| `GET /ws` | WebSocket upgrade |
| `POST /api/upload` | อัปโหลดไฟล์ |
| `GET /api/dictionary` | Translation JSON |
| `GET /api/post/:id` | ดึงโพสต์เดี่ยว |
| `GET /media/*` | เสิร์ฟไฟล์ media |
| `/api/admin/*` | Admin REST API (ต้องใช้ `x-admin-token` header) |
| `/admin`, `/admin/*` | Admin SPA |
| `/*` | User SPA fallback |
