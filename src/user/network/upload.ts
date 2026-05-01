import { join } from 'path';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import {
    pickStorageRoot,
    STORAGE_ROOTS,
    picturesPath,
    videosPath,
    mediaUrl,
} from '../../storage.config';

/*
  โครงสร้าง folder ภายใน storage root:
  pictures/
    post/         รูปในโพสต์
    chat/         รูปในแชท
    users/{id}/   รูปโปรไฟล์ + cover ของ user
  videos/
    post/
    chat/
*/

type SourceType = 'post' | 'chat' | 'profile' | 'cover';

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
    if ((source === 'profile' || source === 'cover') && userId) {
        return join('users', userId);
    }
    return source === 'post' ? 'post' : source; // post, chat
}

export async function handleUpload(req: Request): Promise<Response> {
    const formData = await req.formData();
    const file     = formData.get('file');
    const source   = (formData.get('source') as SourceType | null) ?? 'post';
    const userId   = formData.get('userId') as string | null ?? undefined;

    if (!file || !(file instanceof File)) {
        return Response.json({ error: 'No file provided' }, { status: 400 });
    }

    const isImage = IMAGE_TYPES.has(file.type);
    const isVideo = VIDEO_TYPES.has(file.type);

    if (!isImage && !isVideo) {
        return Response.json({ error: 'Unsupported file type' }, { status: 415 });
    }

    // limit: รูป 10MB, วิดีโอ 100MB
    const maxSize = isVideo ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
        return Response.json(
            { error: `ไฟล์ใหญ่เกินไป (สูงสุด ${isVideo ? '100MB' : '10MB'})` },
            { status: 413 }
        );
    }

    // เลือก storage root ที่มีพื้นที่เพียงพอ
    let root: string;
    try {
        root = await pickStorageRoot();
    } catch (e: any) {
        console.error('[Upload] Storage full:', e.message);
        return Response.json({ error: 'Storage full' }, { status: 507 });
    }

    const rootIndex = STORAGE_ROOTS.indexOf(root);
    const ext       = getExt(file.name);
    const filename  = randomName(ext);
    const subDir    = getSubDir(source, userId);

    const dir = isImage
        ? picturesPath(root, subDir)
        : videosPath(root, subDir);

    await ensureDir(dir);
    await Bun.write(join(dir, filename), await file.arrayBuffer());

    const url = mediaUrl(rootIndex, isImage ? 'pictures' : 'videos', subDir, filename);
    return Response.json({ url });
}
