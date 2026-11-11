import { describe, expect, it } from "vitest";
import { GPS_TIFF, losslessWebp, orientedTiff, rotatedJpeg, sized, TINY, VP8_CHUNK, vp8x, webp, WITH_GPS } from "@/test/images";
import { exifOrientation, imageSize, stripMetadata } from "./image-meta";
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

describe("JPEG orientation", () => {
  const exif = (tiff: Uint8Array) => new Uint8Array([...new TextEncoder().encode("Exif\0\0"), ...tiff]);

  it("reads Orientation from IFD0 in either byte order, and only a turn or flip (2–8)", () => {
    expect(exifOrientation(exif(orientedTiff(6)))).toBe(6);
    expect(exifOrientation(exif(orientedTiff(8)))).toBe(8);
    expect(exifOrientation(exif(orientedTiff(1)))).toBeNull(); // upright: nothing to keep
    expect(exifOrientation(exif(orientedTiff(9)))).toBeNull();
    expect(exifOrientation(exif(GPS_TIFF))).toBeNull(); // big-endian, no Orientation
    expect(exifOrientation(exif(orientedTiff(6).slice(0, 12)))).toBeNull(); // cut inside the IFD
    expect(exifOrientation(new TextEncoder().encode("http://ns.adobe.com/xap/1.0/\0"))).toBeNull();
  });

  it("keeps a phone photo's Orientation in a fresh Exif block and drops its GPS, XMP and the rest", () => {
    const out = stripMetadata(rotatedJpeg(6));
    expect(has(out, GPS_TIFF.subarray(26))).toBe(false);
    expect(has(out, "GPSLatitude")).toBe(false);
    expect(has(out, "xap")).toBe(false);
    const app1 = Buffer.from(out).indexOf(Buffer.from([0xff, 0xe1]));
    expect(app1).toBe(20); // where the camera put it, after JFIF
    const segment = out.subarray(app1 + 4, app1 + 2 + ((out[app1 + 2] << 8) | out[app1 + 3]));
    expect(segment.length).toBe(32); // "Exif\0\0", TIFF header, one entry, no next IFD
    expect(exifOrientation(segment)).toBe(6);
    expect(out.subarray(app1 + 36)).toEqual(TINY.jpg.subarray(20)); // the rest byte-exact
    expect(stripMetadata(out)).toEqual(out); // and stable on a second pass
  });

  it("drops an upright photo's Exif entirely", () => {
    expect(stripMetadata(rotatedJpeg(1))).toEqual(TINY.jpg);
  });
});

describe("imageSize", () => {
  it("reads the tiny fixtures as 2×2", () => {
    for (const ext of ["jpg", "png", "webp"] as const) expect(imageSize(TINY[ext]), ext).toEqual({ width: 2, height: 2 });
    expect(imageSize(WITH_GPS.jpg)).toEqual({ width: 2, height: 2 }); // past APP1 segments
    expect(imageSize(WITH_GPS.webp)).toEqual({ width: 2, height: 2 }); // VP8X canvas
  });

  it("reads JPEG SOF, PNG IHDR, the WebP VP8X canvas and a VP8L header", () => {
    const big = sized(4032, 3024);
    expect(imageSize(big.jpg)).toEqual({ width: 4032, height: 3024 });
    expect(imageSize(big.png)).toEqual({ width: 4032, height: 3024 });
    expect(imageSize(big.webp)).toEqual({ width: 4032, height: 3024 });
    expect(imageSize(losslessWebp(512, 300))).toEqual({ width: 512, height: 300 });
    expect(imageSize(losslessWebp(16384, 1))).toEqual({ width: 16384, height: 1 });
  });

  it("is null for anything it can't read", () => {
    for (const bytes of [new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2]), TINY.png.slice(0, 20), TINY.webp.slice(0, 24), sized(0, 2).png, new TextEncoder().encode("GIF89a")]) {
      expect(imageSize(bytes)).toBeNull();
    }
  });
});
