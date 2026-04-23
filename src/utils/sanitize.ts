/**
 * Sanitize user input — strip HTML tags และ dangerous characters
 * ใช้ฝั่ง server ก่อนบันทึก DB
 */
export function sanitizeText(input: string | undefined): string | undefined {
    if (!input) return input;
    return input
        .replace(/<[^>]*>/g, '')           // strip HTML tags
        .replace(/javascript:/gi, '')       // strip javascript: protocol
        .replace(/on\w+\s*=/gi, '')         // strip event handlers
        .trim()
        .slice(0, 5000);                    // max length
}

export function sanitizeShort(input: string | undefined, max = 200): string | undefined {
    if (!input) return input;
    return input
        .replace(/<[^>]*>/g, '')
        .replace(/javascript:/gi, '')
        .trim()
        .slice(0, max);
}
