import { join } from 'path';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';

/*
  โครงสร้าง folder:
  pictures/
    posts/        รูปในโพสต์
    chat/         รูปในแชท
    profile/      รูปโปรไฟล์
    cover/        รูปหน้าปก
    users/
      {userId}/   รูปของ user คนนั้นโดยเฉพาะ
  videos/
    posts/
    chat/
*/

type SourceType = 'post' | 'chat' | 'profile' | 'cover';

const BASE_PICTURES = join(process.cwd(), 'pictures');
const BASE_VIDEOS   = join(process.cwd(), 'videos');

async function ensureDir(path: string): Promise<void> {
    if (!existsSync(path)) await mkdir(path, { recursive: true });
}

function randomName(ext: string): string {
    return `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
}

function getExt(filename: string): string {
    return filename.split('.').pop()?.toLowerCase() ?? 'bin';
}

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']);
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime']);

function getSubDir(source: SourceType, userId?: string): string {
    // profile และ cover แยกตาม userId ด้วย
    if ((source === 'profile' || source === 'cover') && userId) {
        return join('users', userId);
    }
    return source; // posts, chat
}

export async function handleUpload(req: Request): Promise<Response> {
    const formData = await req.formData();
    const file     = formData.get('file');
    const source   = (formData.get('source') as SourceType | null) ?? 'post';
    const userId   = formData.get('userId') as string | null ?? undefined;

    if (!file || !(file instanceof File)) {
        return Response.json({ error: 'No file provided' }, { status: 400 });
    }

    // limit: รูป 10MB, วิดีโอ 100MB
    const isImage = IMAGE_TYPES.has(file.type);
    const isVideo = VIDEO_TYPES.has(file.type);
    const maxSize = isVideo ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
        return Response.json({ error: `ไฟล์ใหญ่เกินไป (สูงสุด ${isVideo ? '100MB' : '10MB'})` }, { status: 413 });
    }

    const mime    = file.type;

    if (!isImage && !isVideo) {
        return Response.json({ error: 'Unsupported file type' }, { status: 415 });
    }

    const ext      = getExt(file.name);
    const filename = randomName(ext);
    const subDir   = getSubDir(source, userId ?? undefined);

    let dir: string;
    let urlBase: string;

    if (isImage) {
        dir     = join(BASE_PICTURES, subDir);
        urlBase = `/pictures/${subDir}`;
    } else {
        dir     = join(BASE_VIDEOS, subDir);
        urlBase = `/videos/${subDir}`;
    }

    await ensureDir(dir);
    await Bun.write(join(dir, filename), await file.arrayBuffer());

    return Response.json({ url: `${urlBase}/${filename}` });
}
