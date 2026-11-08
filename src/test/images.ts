// Tiny real images (2×2, made with cjpeg / cwebp) and copies of them carrying GPS metadata, for upload tests.
import { crc32 } from "node:zlib";

const b64 = (s: string) => new Uint8Array(Buffer.from(s, "base64"));
const ascii = (s: string) => new TextEncoder().encode(s);
const cat = (...parts: Uint8Array[]) => new Uint8Array(Buffer.concat(parts));
const be32 = (n: number) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n); return b; };
const le32 = (n: number) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n, true); return b; };

export const TINY = {
  png: b64("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEklEQVR42mM4oaGhcUKDAUIBAB/uBGHnz5jYAAAAAElFTkSuQmCC"),
  jpg: b64(
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAACAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwAh/wBSn+6KKKK8d7niVv4kvVn/2Q==",
  ),
  webp: b64("UklGRjIAAABXRUJQVlA4ICYAAACQAQCdASoCAAIAAsBMJaACdADBD4AA9oFImuTCfrV7r/Vo/MaAAA=="),
};

/** A big-endian Exif TIFF whose only content is a GPS IFD: 40° 44' 30" N. */
export const GPS_TIFF = (() => {
  const b = new Uint8Array(80);
  const v = new DataView(b.buffer);
  b.set(ascii("MM\0*"), 0);
  v.setUint32(4, 8); // IFD0
  v.setUint16(8, 1); // one entry: GPSInfo → the GPS IFD at 26
  v.setUint16(10, 0x8825); v.setUint16(12, 4); v.setUint32(14, 1); v.setUint32(18, 26);
  v.setUint16(26, 2); // GPS IFD: latitude ref "N" and latitude (3 rationals at 56)
  v.setUint16(28, 1); v.setUint16(30, 2); v.setUint32(32, 2); b.set(ascii("N"), 36);
  v.setUint16(40, 2); v.setUint16(42, 5); v.setUint32(44, 3); v.setUint32(48, 56);
  [40, 1, 44, 1, 3000, 100].forEach((n, i) => v.setUint32(56 + i * 4, n));
  return b;
})();
const XMP = ascii(`<x:xmpmeta xmlns:x="adobe:ns:meta/"><exif:GPSLatitude>40,44.5N</exif:GPSLatitude></x:xmpmeta>`);

const jpegSegment = (marker: number, data: Uint8Array) => cat(new Uint8Array([0xff, marker, (data.length + 2) >> 8, (data.length + 2) & 0xff]), data);
const pngChunk = (type: string, data: Uint8Array) => cat(be32(data.length), ascii(type), data, be32(crc32(cat(ascii(type), data))));
const riffChunk = (type: string, data: Uint8Array) => cat(ascii(type), le32(data.length), data, data.length % 2 ? new Uint8Array(1) : new Uint8Array(0));
export const webp = (...chunks: Uint8Array[]) => { const body = cat(ascii("WEBP"), ...chunks); return cat(ascii("RIFF"), le32(body.length), body); };
/** A VP8X chunk for the 2×2 canvas with the given feature flags. */
export const vp8x = (flags: number) => riffChunk("VP8X", new Uint8Array([flags, 0, 0, 0, 1, 0, 0, 1, 0, 0]));
/** TINY.webp's VP8 chunk (everything after the 12-byte RIFF header). */
export const VP8_CHUNK = TINY.webp.slice(12);

/** TINY images with GPS Exif, XMP and text metadata added in each format's own containers. */
export const WITH_GPS = {
  jpg: cat(
    TINY.jpg.slice(0, 2),
    jpegSegment(0xe1, cat(ascii("Exif\0\0"), GPS_TIFF)),
    TINY.jpg.slice(2, 20), // keep JFIF APP0 first, as cameras do
    jpegSegment(0xe1, cat(ascii("http://ns.adobe.com/xap/1.0/\0"), XMP)),
    jpegSegment(0xed, ascii("Photoshop 3.0\u00008BIM")),
    TINY.jpg.slice(20),
  ),
  png: cat(
    TINY.png.slice(0, 33), // signature + IHDR
    pngChunk("eXIf", GPS_TIFF),
    pngChunk("tEXt", ascii("Comment\0taken at 40.74N")),
    pngChunk("zTXt", ascii("Raw profile type exif\0\0x")),
    pngChunk("iTXt", cat(ascii("XML:com.adobe.xmp\0\0\0\0\0"), XMP)),
    TINY.png.slice(33),
  ),
  webp: webp(vp8x(0x08 | 0x04), VP8_CHUNK, riffChunk("EXIF", GPS_TIFF), riffChunk("XMP ", XMP)), // 93 bytes: odd, so padded
};
