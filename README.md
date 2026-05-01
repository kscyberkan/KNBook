# KN Book — แพลตฟอร์มโซเชียลเน็ตเวิร์ก

KN Book เป็นแอปโซเชียลมีเดียแบบครบวงจรที่สร้างด้วย Bun, React, PostgreSQL และ WebSocket รองรับอินเตอร์เฟซภาษาไทย อังกฤษ จีน และญี่ปุ่น โดยระบบคำแปลจะจัดการด้วยไฟล์ CSV

## ฟีเจอร์

### 🎯 ฟีเจอร์หลัก
- **ฟีด** — เลื่อนดูแบบไม่สิ้นสุด พร้อมอัปเดตแบบเรียลไทม์
- **โพสต์** — ข้อความ รูปภาพ วิดีโอ สติกเกอร์ และความรู้สึก
- **รีแอคชั่น** — 6 แบบ พร้อมป้ายกำกับตามภาษา
- **คอมเมนต์** — ข้อความ รูปภาพ สติกเกอร์ ตอบกลับ @mentions อีโมจิ
- **โปรไฟล์** — อวาตาร์ รูปหน้าปก ประวัติ และสเตตัส

### 👥 ด้านสังคม
- **เพื่อน** — เพิ่ม เพื่อน ยอมรับ ปฏิเสธ ลบ
- **แชท** — ส่งข้อความแบบเรียลไทม์ ไฟล์ รูปภาพ วิดีโอ อีโมจิ
- **การแจ้งเตือน** — แจ้งเตือนแบบเรียลไทม์ พร้อม action
- **บุ๊กมาร์ก** — บันทึกโพสต์ไว้ดูภายหลัง

### 🔐 การยืนยันตัวตน
- เข้าสู่ระบบด้วยชื่อผู้ใช้/รหัสผ่าน
- เข้าสู่ระบบด้วย LINE
- Google OAuth
- จัดการ session พร้อมป้องกันการล็อกอินซ้ำ

### 🌐 การแปลภาษา
- รองรับ: `th`, `en`, `cn`, `jp`
- โหลดคำแปลจาก `public/Dictionary.csv`
- เข้าถึงคำแปลด้วย `t('key.path')`
- บันทึกภาษาที่เลือกไว้ใน `localStorage`

## เทคโนโลยี

**Frontend:**
- React 19
- TypeScript
- Tailwind CSS 4
- Framer Motion
- Lucide Icons

**Backend:**
- Bun (server + WebSocket)
- PostgreSQL
- Prisma 7 (pg adapter)
- โปรโตคอลแพ็กเก็ตไบนารีสำหรับฟีเจอร์เรียลไทม์

**ที่เก็บไฟล์:**
- เก็บไฟล์บนระบบไฟล์ท้องถิ่น
- จัดเรียงตามประเภท: `pictures/{posts|chat|users/{id}}`, `videos/{posts|chat}`

## การติดตั้ง

```bash
bun install
cp .env.example .env
# แก้ไข DATABASE_URL ใน .env
bunx prisma migrate dev
bun dev
```

## คู่มือการแปลภาษา

แอปใช้ระบบพจนานุกรมจาก CSV:

- `public/Dictionary.csv` เก็บคีย์คำแปลและข้อความในแต่ละภาษา
- `/api/dictionary` อ่าน CSV แล้วส่งกลับเป็น JSON แบบ nested
- `src/utils/dictionary.tsx` มี `DictionaryProvider`, `useDictionary()` และ `LangSelector`
- ใช้คำแปลผ่าน `t('namespace.key')`

### เพิ่มหรือแก้ไขคำแปล

1. เปิด `public/Dictionary.csv`
2. เพิ่มหรือแก้ไขแถวที่มีคีย์และค่าคำแปลสำหรับ `th`, `en`, `cn`, `jp`
3. บันทึกและรีโหลดแอป

ตัวอย่าง:

```csv
example.hello,สวัสดี,Hello,你好,こんにちは
```

## โครงสร้างโปรเจกต์

```
src/
  auth/           # UI และ logic ของการยืนยันตัวตน
  components/     # คอมโพเนนต์ UI ที่ใช้ซ้ำได้
    emoji/        # ระบบอีโมจิ SVG
  admin/          # อินเตอร์เฟซผู้ดูแลระบบ
  user/           # หน้าของผู้ใช้และฟีเจอร์ต่าง ๆ
  network/        # WebSocket client และ helpers ของ API
  prisma/         # คำสั่งฐานข้อมูลและ helpers
  types/          # TypeScript types
  utils/          # ฮีลเปอร์และพจนานุกรม

public/
  Dictionary.csv  # ไฟล์คำแปล

prisma/
  schema.prisma   # สคีมาฐานข้อมูล
  migrations/     # ประวัติการย้ายฐานข้อมูล
```

## การใช้งาน

```bash
bun dev
```

## คำสั่งที่ใช้บ่อย

```bash
bunx prisma studio
bunx prisma migrate dev
bunx prisma generate
bun run build
```

## หมายเหตุ

- ตัวเลือกภาษาอังกฤษตอนนี้ใช้ธงสหรัฐ `🇺🇸` เพื่อความสอดคล้อง
- หากคำแปลหาย ระบบจะคืนค่าเป็นคีย์คำแปลแทน
- การเลือกภาษาจะถูกเก็บไว้ใน `localStorage` และนำกลับมาใช้ใน session ถัดไป

## ใบอนุญาต

MIT
