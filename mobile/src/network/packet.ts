// Polyfill for TextEncoder/TextDecoder if missing (some React Native environments)
let encoder: { encode: (s: string) => Uint8Array };
let decoder: { decode: (b: Uint8Array) => string };

try {
    encoder = new TextEncoder();
    decoder = new TextDecoder('utf-8');
} catch (e) {
    console.warn('[Packet] TextEncoder/Decoder missing, using fallback');
    encoder = {
        encode: (s: string) => {
            const arr = new Uint8Array(s.length * 3);
            let p = 0;
            for (let i = 0; i < s.length; i++) {
                let c = s.charCodeAt(i);
                if (c < 128) arr[p++] = c;
                else if (c < 2048) {
                    arr[p++] = (c >> 6) | 192;
                    arr[p++] = (c & 63) | 128;
                } else {
                    arr[p++] = (c >> 12) | 224;
                    arr[p++] = ((c >> 6) & 63) | 128;
                    arr[p++] = (c & 63) | 128;
                }
            }
            return arr.slice(0, p);
        }
    };
    decoder = {
        decode: (b: Uint8Array) => {
            let s = '';
            for (let i = 0; i < b.length; i++) {
                let c = b[i]!;
                if (c < 128) s += String.fromCharCode(c);
                else if (c > 191 && c < 224) {
                    s += String.fromCharCode(((c & 31) << 6) | (b[++i]! & 63));
                } else {
                    s += String.fromCharCode(((c & 15) << 12) | ((b[++i]! & 63) << 6) | (b[++i]! & 63));
                }
            }
            return s;
        }
    };
}

class Packet {
    private bytes: Uint8Array;
    private view: DataView;
    private writePos: number;
    private readPos: number;

    constructor(packetId: number) {
        this.bytes = new Uint8Array(64);
        this.view = new DataView(this.bytes.buffer);
        this.writePos = 0;
        this.readPos = 4; // Skip packet id

        this.writeInt(packetId);
    }

    private ensure(extra: number): void {
        const needed = this.writePos + extra;
        if (needed <= this.bytes.length) return;
        let newSize = this.bytes.length * 2;
        while (newSize < needed) newSize *= 2;
        const next = new Uint8Array(newSize);
        next.set(this.bytes);
        this.bytes = next;
        this.view = new DataView(this.bytes.buffer, this.bytes.byteOffset, this.bytes.byteLength);
    }

    public forceCopyBuffer(data: ArrayBuffer | Uint8Array): void {
        if (data instanceof Uint8Array) {
            this.bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength).slice();
        } else {
            this.bytes = new Uint8Array(data);
        }
        this.view = new DataView(this.bytes.buffer);
        this.writePos = this.bytes.length;
        this.readPos = 4;
    }

    public getPacketID(): number {
        return this.view.getInt32(0, true);
    }

    public writeBytes(value: Uint8Array): void {
        this.writeInt(value.length);
        this.ensure(value.length);
        this.bytes.set(value, this.writePos);
        this.writePos += value.length;
    }

    public writeShort(value: number): void {
        this.ensure(2);
        this.view.setInt16(this.writePos, value, true);
        this.writePos += 2;
    }

    public writeInt(value: number): void {
        this.ensure(4);
        this.view.setInt32(this.writePos, value, true);
        this.writePos += 4;
    }

    public writeLong(value: bigint): void {
        this.ensure(8);
        this.view.setBigInt64(this.writePos, value, true);
        this.writePos += 8;
    }

    public writeFloat(value: number): void {
        this.ensure(4);
        this.view.setFloat32(this.writePos, value, true);
        this.writePos += 4;
    }

    public writeBool(value: boolean): void {
        this.ensure(1);
        this.view.setUint8(this.writePos, value ? 1 : 0);
        this.writePos += 1;
    }

    public writeString(value: string): void {
        const encoded = encoder.encode(value);
        this.writeInt(encoded.length);
        this.ensure(encoded.length);
        this.bytes.set(encoded, this.writePos);
        this.writePos += encoded.length;
    }

    public readBytes(movePos = true): Uint8Array {
        const length = this.readInt(movePos);
        const value = this.bytes.slice(this.readPos, this.readPos + length);
        if (movePos) this.readPos += length;
        return value;
    }

    public readShort(movePos = true): number {
        const value = this.view.getInt16(this.readPos, true);
        if (movePos) this.readPos += 2;
        return value;
    }

    public readInt(movePos = true): number {
        const value = this.view.getInt32(this.readPos, true);
        if (movePos) this.readPos += 4;
        return value;
    }

    public readLong(movePos = true): bigint {
        const value = this.view.getBigInt64(this.readPos, true);
        if (movePos) this.readPos += 8;
        return value;
    }

    public readFloat(movePos = true): number {
        const value = this.view.getFloat32(this.readPos, true);
        if (movePos) this.readPos += 4;
        return value;
    }

    public readBool(movePos = true): boolean {
        const value = this.view.getUint8(this.readPos) === 1;
        if (movePos) this.readPos += 1;
        return value;
    }

    public readString(movePos = true): string {
        const length = this.readInt(movePos);
        const strBytes = this.bytes.slice(this.readPos, this.readPos + length);
        if (movePos) this.readPos += length;
        return decoder.decode(strBytes);
    }

    public toBuffer(): Uint8Array {
        return this.bytes.slice(0, this.writePos);
    }
}

export default Packet;
