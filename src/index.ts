import { serve } from 'bun';
import index from './user/index.html';
import adminIndex from './admin/index.html';
import Packet from '@user/network/packet';
import { handler, onDisconnect } from '@user/network/handler';
import { handleUpload } from '@user/network/upload';
import type { WS } from '@user/network/session';
import { join } from 'path';
import { handleAdminApi } from './admin/api';
import { resolveMediaPath } from './storage.config';

// suppress pg deprecation warning จาก @prisma/adapter-pg internals
const _emitWarning = process.emitWarning.bind(process);
(process as NodeJS.Process).emitWarning = (warning: string | Error, ...args: unknown[]) => {
    const msg = typeof warning === 'string' ? warning : warning.message;
    if (msg.includes('already executing a query')) return;
    (_emitWarning as (...a: unknown[]) => void)(warning, ...args);
};

const server = serve({
    routes: {
        // WebSocket upgrade
        '/ws': (req) => {
            if (server.upgrade(req, { data: {} })) return;
            return new Response('WebSocket only', { status: 426 });
        },

        // Admin API
        '/api/admin/*': async (req) => handleAdminApi(req),

        // Admin SPA
        '/admin': adminIndex,
        '/admin/*': adminIndex,

        // File upload
        '/api/upload': {
            async POST(req) {
                return handleUpload(req);
            },
        },

        // Get single post
        '/api/post/:id': async (req) => {
            const { getPostById } = await import('@/prisma/post');
            const { normalizePostForApi } = await import('@user/network/handler');
            const post = await getPostById(Number(req.params.id));
            if (!post) return new Response('Not found', { status: 404 });
            return Response.json(normalizePostForApi(post));
        },

        // Dictionary — parse CSV → nested JSON
        '/api/dictionary': async () => {
            const file = Bun.file(join(process.cwd(), 'public', 'Dictionary.csv'));
            const text = await file.text();
            const lines = text.split(/\r?\n/).filter((line) => line.trim());

            function parseCsvLine(line: string) {
                const cols: string[] = [];
                let current = '';
                let inQuotes = false;

                for (let i = 0; i < line.length; i++) {
                    const ch = line[i]!;
                    if (ch === '"') {
                        if (inQuotes && line[i + 1] === '"') {
                            current += '"';
                            i++;
                        } else {
                            inQuotes = !inQuotes;
                        }
                        continue;
                    }
                    if (ch === ',' && !inQuotes) {
                        cols.push(current.trim());
                        current = '';
                        continue;
                    }
                    current += ch;
                }
                cols.push(current.trim());
                return cols.map((value) => value.replace(/\r$/, '').trim());
            }

            const headers = parseCsvLine(lines[0]!); // key,th,en,cn,jp
            const langs = headers.slice(1).map((lang) => lang.replace(/\r$/, '').trim());

            // Build flat map first: { "nav.home": { th: "...", en: "..." } }
            const flat: Record<string, Record<string, string>> = {};
            for (const line of lines.slice(1)) {
                const cols = parseCsvLine(line);
                if (!cols[0]) continue;
                const key = cols[0]!;
                flat[key] = {};
                langs.forEach((lang, i) => {
                    flat[key]![lang] = cols[i + 1] ?? '';
                });
            }

            // Build nested per-lang: { th: { nav: { home: "..." } }, en: { ... } }
            const result: Record<string, Record<string, unknown>> = {};
            for (const lang of langs) {
                result[lang] = {};
                for (const [dotKey, translations] of Object.entries(flat)) {
                    const parts = dotKey.split('.');
                    let node = result[lang] as Record<string, unknown>;
                    for (let i = 0; i < parts.length - 1; i++) {
                        const part = parts[i]!;
                        if (!node[part]) node[part] = {};
                        node = node[part] as Record<string, unknown>;
                    }
                    node[parts[parts.length - 1]!] = translations[lang] ?? '';
                }
            }

            return Response.json(result, {
                headers: { 'Cache-Control': 'public, max-age=60' },
            });
        },

        // Static file serving — multi-drive (new uploads)
        '/media/*': (req) => {
            const url      = new URL(req.url);
            const filePath = resolveMediaPath(url.pathname);
            if (!filePath) return new Response('Not found', { status: 404 });
            const file = Bun.file(filePath);
            return new Response(file);
        },

        // Sticker assets served from local project folder
        '/stickers/*': (req) => {
            const url = new URL(req.url);
            const assetPath = url.pathname.replace('/stickers/', '').split('/').filter(Boolean).join('/');
            try {
                return new Response(Bun.file(join(process.cwd(), 'stickers', assetPath)));
            } catch {
                return new Response('Not found', { status: 404 });
            }
        },

        // Static file serving — backward compat (old uploads in project folder)
        '/pictures/*': (req) => {
            const url  = new URL(req.url);
            const path = url.pathname.replace('/pictures/', '');
            return new Response(Bun.file(join(process.cwd(), 'pictures', path)));
        },

        '/videos/*': (req) => {
            const url  = new URL(req.url);
            const path = url.pathname.replace('/videos/', '');
            return new Response(Bun.file(join(process.cwd(), 'videos', path)));
        },

        // SPA fallback
        '/*': index,
    },

    // Bun native WebSocket
    websocket: {
        open(_socket: WS) {
            // รอ login packet ก่อน register session
        },

        async message(socket: WS, data: Buffer | string) {
            const buf = typeof data === 'string'
                ? new TextEncoder().encode(data)
                : new Uint8Array(data);
            const packet = new Packet(0);
            packet.forceCopyBuffer(buf);
            await handler(socket, packet);
        },

        close(socket: WS) {
            onDisconnect(socket);
        },
    },

    development: process.env.NODE_ENV !== 'production' && {
        hmr: true,
        console: true,
    },
});

console.log(`🚀 Server running at ${server.url}`);
console.log(`🔌 WebSocket at ws://${server.url.host}/ws`);
