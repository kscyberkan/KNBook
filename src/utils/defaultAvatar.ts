/**
 * สร้าง SVG avatar จาก initials ของชื่อ
 * บันทึกเป็นไฟล์ใน pictures/users/{userId}/avatar.svg
 */

const COLORS: [string, string][] = [
    ['#5B65F2', '#AAB0F9'],
    ['#ef4444', '#fca5a5'],
    ['#f59e0b', '#fcd34d'],
    ['#10b981', '#6ee7b7'],
    ['#8b5cf6', '#c4b5fd'],
    ['#ec4899', '#f9a8d4'],
    ['#06b6d4', '#67e8f9'],
    ['#f97316', '#fdba74'],
];

function pickColor(name: string): [string, string] {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return COLORS[Math.abs(hash) % COLORS.length]!;
}

export function generateDefaultAvatarSvg(name: string): string {
    const initial = name.trim()[0]?.toUpperCase() ?? '?';
    const [bg, text] = pickColor(name);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
  <circle cx="100" cy="100" r="100" fill="${bg}"/>
  <text x="100" y="100" dy="0.35em" text-anchor="middle" font-family="Arial,sans-serif" font-size="90" font-weight="bold" fill="${text}">${initial}</text>
</svg>`;
}

export async function createDefaultAvatar(userId: string, name: string): Promise<string> {
    const svg = generateDefaultAvatarSvg(name);
    const dir = `pictures/users/${userId}`;
    const filepath = `${dir}/avatar.svg`;

    // สร้าง folder ถ้ายังไม่มี
    const { mkdir } = await import('fs/promises');
    const { existsSync } = await import('fs');
    if (!existsSync(dir)) await mkdir(dir, { recursive: true });

    await Bun.write(filepath, svg);
    return `/pictures/users/${userId}/avatar.svg`;
}
