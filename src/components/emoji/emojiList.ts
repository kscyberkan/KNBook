export interface EmojiDef {
  id: string;
  label: string;
  svg: string; // inline SVG string
}

// ใช้ twemoji-style SVG paths (simplified)
const face = (content: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36">${content}</svg>`;

export const EMOJIS: EmojiDef[] = [
  {
    id: 'smile',
    label: 'ยิ้ม',
    svg: face(`<circle fill="#FFCC4D" cx="18" cy="18" r="18"/><circle fill="#664500" cx="12" cy="14" r="2.5"/><circle fill="#664500" cx="24" cy="14" r="2.5"/><path fill="#664500" d="M18 22c-3.623 0-6.027-1.225-6.027-2.5 0-.414.336-.75.75-.75h10.554c.414 0 .75.336.75.75C24.027 20.775 21.623 22 18 22z"/>`),
  },
  {
    id: 'laugh',
    label: 'หัวเราะ',
    svg: face(`<circle fill="#FFCC4D" cx="18" cy="18" r="18"/><path fill="#664500" d="M5 15.5C5 14.119 6.119 13 7.5 13S10 14.119 10 15.5 8.881 18 7.5 18 5 16.881 5 15.5zm21 0C26 14.119 27.119 13 28.5 13S31 14.119 31 15.5 29.881 18 28.5 18 26 16.881 26 15.5z"/><path fill="#664500" d="M18 34c-7.732 0-14-4.701-14-10.5h28C32 29.299 25.732 34 18 34z"/><path fill="#fff" d="M4 23.5h28v1H4z"/>`),
  },
  {
    id: 'heart_eyes',
    label: 'หัวใจ',
    svg: face(`<circle fill="#FFCC4D" cx="18" cy="18" r="18"/><path fill="#DD2E44" d="M9.188 8.938C7.48 7.229 4.719 7.229 3.01 8.938c-1.708 1.708-1.708 4.469 0 6.177L9.188 21.3l6.177-6.185c1.708-1.708 1.708-4.469 0-6.177-1.708-1.709-4.469-1.709-6.177 0zm17.625 0c-1.708-1.709-4.469-1.709-6.177 0-1.708 1.708-1.708 4.469 0 6.177l6.177 6.185 6.177-6.185c1.708-1.708 1.708-4.469 0-6.177-1.709-1.709-4.469-1.709-6.177 0z"/><path fill="#664500" d="M18 22c-3.623 0-6.027-1.225-6.027-2.5h12.054C24.027 20.775 21.623 22 18 22z"/>`),
  },
  {
    id: 'cry',
    label: 'ร้องไห้',
    svg: face(`<circle fill="#FFCC4D" cx="18" cy="18" r="18"/><circle fill="#664500" cx="12" cy="13.5" r="2.5"/><circle fill="#664500" cx="24" cy="13.5" r="2.5"/><path fill="#664500" d="M18 24c-3.623 0-6.027-1.225-6.027-2.5h12.054C24.027 22.775 21.623 24 18 24z"/><path fill="#5DADEC" d="M10 17.5c0 1.381-1.119 2.5-2.5 2.5S5 18.881 5 17.5 6.119 15 7.5 15 10 16.119 10 17.5zm16 0c0 1.381 1.119 2.5 2.5 2.5s2.5-1.119 2.5-2.5S29.881 15 28.5 15 26 16.119 26 17.5z"/>`),
  },
  {
    id: 'angry',
    label: 'โกรธ',
    svg: face(`<circle fill="#DD2E44" cx="18" cy="18" r="18"/><circle fill="#664500" cx="12" cy="17" r="2.5"/><circle fill="#664500" cx="24" cy="17" r="2.5"/><path fill="#664500" d="M18 26c-3.623 0-6.027-1.225-6.027-2.5h12.054C24.027 24.775 21.623 26 18 26z"/><path fill="#664500" d="M8.5 10.5l5 3-5-3zm19 0l-5 3 5-3z"/>`),
  },
  {
    id: 'surprised',
    label: 'ตกใจ',
    svg: face(`<circle fill="#FFCC4D" cx="18" cy="18" r="18"/><circle fill="#664500" cx="12" cy="14" r="2.5"/><circle fill="#664500" cx="24" cy="14" r="2.5"/><ellipse fill="#664500" cx="18" cy="24" rx="4" ry="5"/>`),
  },
  {
    id: 'wink',
    label: 'ขยิบตา',
    svg: face(`<circle fill="#FFCC4D" cx="18" cy="18" r="18"/><path fill="#664500" d="M10 13.5c0-1.381 1.119-2.5 2.5-2.5s2.5 1.119 2.5 2.5-1.119 2.5-2.5 2.5-2.5-1.119-2.5-2.5z"/><path fill="#664500" d="M21 14h6"/><path fill="#664500" d="M18 22c-3.623 0-6.027-1.225-6.027-2.5h12.054C24.027 20.775 21.623 22 18 22z"/>`),
  },
  {
    id: 'cool',
    label: 'เท่',
    svg: face(`<circle fill="#FFCC4D" cx="18" cy="18" r="18"/><path fill="#292F33" d="M2 12h32v6H2z" rx="3"/><circle fill="#fff" cx="11" cy="15" r="3"/><circle fill="#fff" cx="25" cy="15" r="3"/><path fill="#664500" d="M18 22c-3.623 0-6.027-1.225-6.027-2.5h12.054C24.027 20.775 21.623 22 18 22z"/>`),
  },
  {
    id: 'thumbsup',
    label: 'ถูกใจ',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#FFCC4D" d="M36 18.5C36 8.835 27.941 1 18 1S0 8.835 0 18.5C0 28.165 8.059 36 18 36s18-7.835 18-17.5z"/><path fill="#664500" d="M10 22h16v2H10zm3-8h2v6h-2zm8 0h2v6h-2z"/></svg>`,
  },
  {
    id: 'fire',
    label: 'ไฟ',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#F4900C" d="M18 36C8.059 36 0 27.941 0 18S8.059 0 18 0s18 8.059 18 18-8.059 18-18 18z"/><path fill="#FFCC4D" d="M18 6c0 0-8 6-8 14a8 8 0 0016 0C26 12 18 6 18 6z"/><path fill="#fff" d="M18 16c0 0-4 3-4 7a4 4 0 008 0c0-4-4-7-4-7z"/></svg>`,
  },
  {
    id: 'heart',
    label: 'หัวใจ',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#DD2E44" d="M35.885 11.833c0-5.45-4.418-9.868-9.867-9.868-3.308 0-6.227 1.633-8.018 4.129-1.791-2.496-4.71-4.129-8.017-4.129-5.45 0-9.868 4.418-9.868 9.868 0 .772.098 1.52.266 2.241C1.751 22.587 11.216 31.568 18 34.034c6.783-2.466 16.249-11.447 17.617-19.959.17-.721.268-1.469.268-2.242z"/></svg>`,
  },
  {
    id: 'clap',
    label: 'ปรบมือ',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle fill="#FFCC4D" cx="18" cy="18" r="18"/><path fill="#664500" d="M12 10l3 3-3-3zm12 0l-3 3 3-3zM18 26c-4 0-7-2-7-4h14c0 2-3 4-7 4z"/></svg>`,
  },
];

export const EMOJI_MAP = new Map(EMOJIS.map(e => [e.id, e]));

export function getEmojiSvg(id: string): string {
  return EMOJI_MAP.get(id)?.svg ?? '';
}
