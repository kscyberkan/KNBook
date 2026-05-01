// ============================================================
//  Storage Config — multi-drive file storage
//
//  เพิ่ม/ลด path ได้ที่ STORAGE_ROOTS
//  ระบบจะเลือก drive แรกที่มีพื้นที่ว่างเกิน MIN_FREE_BYTES
//  ถ้าทุก drive เต็ม จะ throw error
// ============================================================

import { statfs } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

// ── Config ────────────────────────────────────────────────────
export const STORAGE_ROOTS: string[] = [
    'D:/knbook_source',
    'E:/knbook_source',
];

// พื้นที่ว่างขั้นต่ำก่อนจะข้ามไป drive ถัดไป (default 1 GB)
const MIN_FREE_BYTES = 1 * 1024 * 1024 * 1024;

// ── Helper: ตรวจพื้นที่ว่างของ path ──────────────────────────
async function getFreeBytes(path: string): Promise<number> {
    try {
        const stats = await statfs(path);
        return stats.bfree * stats.bsize;
    } catch {
        return 0;
    }
}

// ── เลือก root ที่ใช้งานได้และมีพื้นที่เพียงพอ ───────────────
export async function pickStorageRoot(): Promise<string> {
    for (const root of STORAGE_ROOTS) {
        // ถ้า path ยังไม่มีให้ถือว่าใช้ได้ (จะสร้างตอน write)
        if (!existsSync(root)) return root;
        const free = await getFreeBytes(root);
        if (free >= MIN_FREE_BYTES) return root;
    }
    throw new Error(
        `Storage full: ทุก drive มีพื้นที่ว่างน้อยกว่า ${MIN_FREE_BYTES / 1024 / 1024 / 1024} GB\n` +
        `Configured paths: ${STORAGE_ROOTS.join(', ')}`
    );
}

// ── Sub-paths ภายใน root ─────────────────────────────────────
export const PICTURES_DIR = 'pictures';
export const VIDEOS_DIR   = 'videos';

export function picturesPath(root: string, sub: string): string {
    return join(root, PICTURES_DIR, sub);
}

export function videosPath(root: string, sub: string): string {
    return join(root, VIDEOS_DIR, sub);
}

// ── URL prefix สำหรับ serve ───────────────────────────────────
//  /media/0/pictures/...  → STORAGE_ROOTS[0]/pictures/...
//  /media/1/pictures/...  → STORAGE_ROOTS[1]/pictures/...
export function mediaUrl(rootIndex: number, type: 'pictures' | 'videos', sub: string, filename: string): string {
    return `/media/${rootIndex}/${type}/${sub}/${filename}`;
}

// ── หา root index จาก URL ────────────────────────────────────
export function resolveMediaPath(pathname: string): string | null {
    // /media/{index}/{type}/{...rest}
    const m = pathname.match(/^\/media\/(\d+)\/(.+)$/);
    if (!m) return null;
    const idx = Number(m[1]);
    const rest = m[2]!;
    const root = STORAGE_ROOTS[idx];
    if (!root) return null;
    return join(root, rest);
}
