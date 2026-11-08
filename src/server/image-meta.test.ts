import { describe, expect, it } from "vitest";
import { GPS_TIFF, TINY, VP8_CHUNK, vp8x, webp, WITH_GPS } from "@/test/images";
import { stripMetadata } from "./image-meta";
import { sniffImage } from "./media";

const has = (bytes: Uint8Array, needle: Uint8Array | string) =>
  Buffer.from(bytes).indexOf(typeof needle === "string" ? Buffer.from(needle) : Buffer.from(needle)) !== -1;

describe("stripMetadata", () => {
  it("leaves clean images byte-for-byte as they are", () => {
    for (const ext of ["jpg", "png", "webp"] as const) expect(stripMetadata(TINY[ext])).toEqual(TINY[ext]);
  });

  for (const ext of ["jpg", "png", "webp"] as const) {
    it(`removes GPS Exif and XMP from a ${ext}, keeping the same image type`, () => {
      expect(has(WITH_GPS[ext], GPS_TIFF)).toBe(true);
      const out = stripMetadata(WITH_GPS[ext]);
      expect(has(out, GPS_TIFF)).toBe(false);
      expect(has(out, "Exif")).toBe(false);
      expect(has(out, "GPSLatitude")).toBe(false);
      expect(sniffImage(out)).toBe(ext);
      expect(stripMetadata(out)).toEqual(out); // still parses as a whole image
    });
  }

  it("JPEG: drops APP1 (Exif, XMP) and APP13, keeps every other segment and the scan data byte-exact", () => {
    expect(stripMetadata(WITH_GPS.jpg)).toEqual(TINY.jpg);
  });

  it("PNG: drops eXIf, tEXt, zTXt and iTXt, keeps IHDR, IDAT and IEND byte-exact", () => {
    expect(stripMetadata(WITH_GPS.png)).toEqual(TINY.png);
  });

  it("WebP: drops EXIF and XMP chunks, clears their VP8X flags, keeps the VP8 chunk and fixes the RIFF size", () => {
    expect(stripMetadata(WITH_GPS.webp)).toEqual(webp(vp8x(0), VP8_CHUNK));
  });

  it("drops anything after the end of the image", () => {
    const trailer = new TextEncoder().encode("GPS 40.74N");
    for (const ext of ["jpg", "png"] as const) expect(stripMetadata(new Uint8Array([...TINY[ext], ...trailer]))).toEqual(TINY[ext]);
  });

  it("rejects malformed images instead of passing them through", () => {
    const bad = [
      TINY.jpg.slice(0, 100), // cut inside a segment
      TINY.jpg.slice(0, -2), // no end-of-image marker
      new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]),
      new Uint8Array([...TINY.jpg.slice(0, 20), 0x00, ...TINY.jpg.slice(20)]), // junk between segments
      TINY.png.slice(0, 50), // cut inside IDAT
      TINY.png.slice(0, -12), // no IEND
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]),
      TINY.webp.slice(0, 40), // RIFF size beyond the end
      webp(), // no image chunk
      webp(VP8_CHUNK.slice(0, 20)), // chunk size beyond the RIFF body
      new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]),
    ];
    for (const bytes of bad) expect(() => stripMetadata(bytes), String(bytes.length)).toThrow(/couldn’t be read/);
  });
});
