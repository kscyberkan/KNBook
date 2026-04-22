# KN Book — Social Network Platform

Full-stack social media application built with Bun, React, PostgreSQL, and WebSocket.

## Features

### 🎯 Core
- **Feed** — Infinite scroll, real-time updates
- **Posts** — Text, images, videos, stickers, feelings
- **Reactions** — 6 types (ถูกใจ, รัก, ฮ่าๆ, เฉยๆ, เศร้า, โกรธ)
- **Comments** — Text, images, stickers, replies, @mentions, emoji support
- **Share** — Unlimited depth chain

### 👥 Social
- **Friends** — Add, accept, decline, remove
- **Chat** — Real-time messaging, files, images, videos, emoji
- **Notifications** — Real-time push, actionable (accept friend requests)
- **Profile** — Avatar, cover, bio, stats

### 🔐 Auth
- Username/password
- LINE Login
- Google OAuth
- Session management (force logout on duplicate login)

### 🎨 UI/UX
- Responsive design (mobile + desktop)
- Framer Motion animations
- Modal system (no alert/confirm)
- Emoji SVG system (`:emojiId:` → render SVG)
- Lightbox for images/videos
- Custom video player

## Tech Stack

**Frontend:**
- React 19
- TypeScript
- Tailwind CSS 4
- Framer Motion
- Lucide Icons

**Backend:**
- Bun (serve + WebSocket)
- PostgreSQL
- Prisma 7 (with pg adapter)
- Binary packet protocol (DataView/Uint8Array)

**File Storage:**
- Local filesystem
- Organized by type: `pictures/{posts|chat|users/{id}}`, `videos/{posts|chat}`

## Setup

```bash
# Install dependencies
bun install

# Setup database
cp .env.example .env
# Edit DATABASE_URL in .env

# Run migrations
bunx prisma migrate dev

# Start dev server
bun dev
```

## Project Structure

```
src/
  ├── auth/           # Login, register, LINE/Google OAuth
  ├── components/     # Reusable UI components
  │   ├── emoji/      # SVG emoji system
  │   ├── Avatar.tsx
  │   ├── Modal.tsx
  │   ├── FeedItem.tsx
  │   ├── CreatePost.tsx
  │   ├── ChatWindow.tsx
  │   └── ...
  ├── pages/          # Main pages (Feed, Profile, EditProfile)
  ├── network/        # WebSocket client/server, packet protocol
  ├── prisma/         # Database queries (user, post, comment, etc.)
  ├── types/          # TypeScript interfaces
  └── utils/          # Helpers (storage, theme, defaultAvatar)

prisma/
  ├── schema.prisma   # Database schema
  └── migrations/     # Migration history
```

## API

### WebSocket Packets
- Auth: LOGIN, REGISTER, RESUME, LOGOUT
- Posts: CREATE_POST, GET_FEED, GET_USER_POSTS, DELETE_POST
- Reactions: REACT_POST, UNREACT_POST
- Comments: CREATE_COMMENT (with image/sticker/reply support)
- Chat: SEND_MESSAGE, GET_CONVERSATION, READ_MESSAGES
- Friends: SEND_FRIEND_REQUEST, ACCEPT_FRIEND_REQUEST, REMOVE_FRIEND
- Notifications: GET_NOTIFICATIONS, MARK_NOTIFICATION_READ

### REST API
- `POST /api/upload` — Upload files (auto-organized by source type)
- `GET /api/post/:id` — Get single post
- `GET /pictures/*` — Serve images
- `GET /videos/*` — Serve videos

## Database Schema

- **User** — Profile, auth, timestamps
- **Post** — Content, media, feelings, share chain
- **Reaction** — Type, user (unique per post+user)
- **Comment** — Text, media, reply chain
- **Message** — Chat messages, files, read status
- **Notification** — Type, from/to, handled status
- **Friendship** — Requester/addressee, status (pending/accepted)

## Development

```bash
# Dev mode with hot reload
bun dev

# Build for production
bun run build

# Database commands
bunx prisma studio          # Open database GUI
bunx prisma migrate dev     # Create migration
bunx prisma generate        # Regenerate client
```

## License

MIT
