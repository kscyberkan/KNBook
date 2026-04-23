/**
 * Simple in-memory rate limiter per userId per action
 * windowMs: time window in ms
 * max: max requests per window
 */

interface Bucket {
    count: number;
    resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function checkRateLimit(userId: number, action: string, max: number, windowMs: number): boolean {
    const key = `${userId}:${action}`;
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || now > bucket.resetAt) {
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        return true; // allowed
    }

    if (bucket.count >= max) return false; // blocked

    bucket.count++;
    return true;
}

// cleanup เก่าทุก 5 นาที
setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
        if (now > bucket.resetAt) buckets.delete(key);
    }
}, 5 * 60 * 1000);
