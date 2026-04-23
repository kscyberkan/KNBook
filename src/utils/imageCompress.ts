/**
 * Compress image file using Canvas API before upload
 * - maxWidth/maxHeight: resize ถ้าใหญ่เกิน
 * - quality: JPEG quality 0-1
 * - maxSizeKB: ถ้าไฟล์เล็กกว่านี้อยู่แล้วจะ skip compression
 */
export async function compressImage(
    file: File,
    options: { maxWidth?: number; maxHeight?: number; quality?: number; maxSizeKB?: number } = {}
): Promise<File> {
    const { maxWidth = 1920, maxHeight = 1920, quality = 0.82, maxSizeKB = 300 } = options;

    // skip ถ้าไม่ใช่รูปหรือเล็กพออยู่แล้ว
    if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') return file;
    if (file.size <= maxSizeKB * 1024) return file;

    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            let { width, height } = img;

            // scale down ถ้าใหญ่เกิน
            if (width > maxWidth || height > maxHeight) {
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                width = Math.round(width * ratio);
                height = Math.round(height * ratio);
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob(
                blob => {
                    if (!blob) { resolve(file); return; }
                    resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
                },
                'image/jpeg',
                quality
            );
        };
        img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
        img.src = url;
    });
}
