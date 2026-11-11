// Strips location-bearing metadata (Exif, XMP, IPTC, text chunks) from an uploaded image before it is stored, and reads
// its pixel size. Walks each format's own container and copies every other byte as it was; pixels are never decoded.
// A JPEG's Exif Orientation is the one tag kept (in a fresh, minimal Exif block), so a phone photo stays upright.
import { AccessError } from "./guard";

const unreadable = () => new AccessError("That image couldn’t be read. Please choose another JPG, PNG or WebP.", 400);
const ascii = (b: Uint8Array, at: number) => String.fromCharCode(b[at], b[at + 1], b[at + 2], b[at + 3]);
const join = (parts: Uint8Array[]) => new Uint8Array(Buffer.concat(parts));

const EXIF_HEADER = [0x45, 0x78, 0x69, 0x66, 0, 0]; // "Exif\0\0"

/** The Exif Orientation (0x0112) in IFD0 of an APP1 segment's data, when it is a turn or flip (2–8); else null. */
export function exifOrientation(data: Uint8Array): number | null {
  if (data.length < 14 || !EXIF_HEADER.every((c, j) => data[j] === c)) return null;
  const tiff = data.subarray(6);
  const v = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
  const order = ascii(tiff, 0).slice(0, 2);
  if (order !== "II" && order !== "MM") return null;
  const le = order === "II";
  if (v.getUint16(2, le) !== 42) return null;
  const ifd = v.getUint32(4, le);
  if (ifd < 8 || ifd + 2 > tiff.length) return null;
  const count = v.getUint16(ifd, le);
  for (let e = ifd + 2, n = 0; n < count && e + 12 <= tiff.length; n++, e += 12) {
    if (v.getUint16(e, le) !== 0x0112) continue;
    if (v.getUint16(e + 2, le) !== 3 || v.getUint32(e + 4, le) !== 1) return null; // one SHORT
    const value = v.getUint16(e + 8, le);
    return value >= 2 && value <= 8 ? value : null;
  }
  return null;
}

/** An APP1 segment holding only an Exif IFD0 with one entry: Orientation. */
function orientationSegment(value: number): Uint8Array {
  const b = new Uint8Array(4 + 6 + 26);
  const v = new DataView(b.buffer);
  b.set([0xff, 0xe1], 0);
  v.setUint16(2, b.length - 2);
  b.set(EXIF_HEADER, 4);
  b.set([0x4d, 0x4d, 0, 42], 10); // "MM", 42
  v.setUint32(14, 8); // IFD0 right after the header
  v.setUint16(18, 1); // one entry
  v.setUint16(20, 0x0112); v.setUint16(22, 3); v.setUint32(24, 1); v.setUint16(28, value);
  v.setUint32(32, 0); // no next IFD
  return b;
}

/**
 * JPEG: drops APP1 (Exif, XMP) and APP13 (Photoshop/IPTC) segments and anything after end-of-image. The first Exif
 * block's Orientation, when it turns or flips the picture, comes back as a minimal Exif block in the same place, and
 * nothing else from it (no GPS, camera, maker notes or thumbnail).
 */
function jpeg(b: Uint8Array): Uint8Array {
  const keep: Uint8Array[] = [b.subarray(0, 2)];
  let i = 2;
  let scanned = false;
  let oriented = false;
  for (;;) {
    if (i + 1 >= b.length || b[i] !== 0xff) throw unreadable();
    const m = b[i + 1];
    if (m === 0xff) { keep.push(b.subarray(i, i + 1)); i++; continue; } // fill byte
    if (m === 0xd9) {
      if (!scanned) throw unreadable();
      keep.push(b.subarray(i, i + 2));
      return join(keep);
    }
    if (m === 0x00 || m === 0xd8) throw unreadable();
    let end = i + 2;
    if (m !== 0x01 && (m < 0xd0 || m > 0xd7)) { // everything but standalone markers carries a length
      if (i + 4 > b.length) throw unreadable();
      end = i + 2 + ((b[i + 2] << 8) | b[i + 3]);
      if (end < i + 4 || end > b.length) throw unreadable();
    }
    if (m === 0xda) { // start of scan: entropy-coded data runs to the next marker (not FF00 or a restart)
      scanned = true;
      while (end + 1 < b.length && !(b[end] === 0xff && b[end + 1] !== 0 && (b[end + 1] < 0xd0 || b[end + 1] > 0xd7))) end++;
    }
    if (m !== 0xe1 && m !== 0xed) keep.push(b.subarray(i, end));
    else if (m === 0xe1 && !oriented && !scanned) {
      const value = exifOrientation(b.subarray(i + 4, end));
      if (value) { keep.push(orientationSegment(value)); oriented = true; }
    }
    i = end;
  }
}

const PNG_DROP = new Set(["eXIf", "tEXt", "zTXt", "iTXt"]);

/** PNG: drops eXIf and the three text chunk types, and anything after IEND. */
function png(b: Uint8Array): Uint8Array {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const keep: Uint8Array[] = [b.subarray(0, 8)];
  for (let i = 8; ; ) {
    if (i + 12 > b.length) throw unreadable();
    const type = ascii(b, i + 4);
    const end = i + 12 + v.getUint32(i);
    if (end > b.length || (i === 8) !== (type === "IHDR")) throw unreadable();
    if (!PNG_DROP.has(type)) keep.push(b.subarray(i, end));
    if (type === "IEND") return join(keep);
    i = end;
  }
}

const EXIF_FLAG = 0x08;
const XMP_FLAG = 0x04;

/** WebP: drops EXIF and XMP chunks, clears their VP8X flags and rewrites the RIFF size. */
function webp(b: Uint8Array): Uint8Array {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const riffEnd = 8 + v.getUint32(4, true);
  if (riffEnd > b.length || riffEnd < 12) throw unreadable();
  const keep: Uint8Array[] = [];
  let image = false;
  for (let i = 12; i < riffEnd; ) {
    if (i + 8 > riffEnd) throw unreadable();
    const type = ascii(b, i);
    const size = v.getUint32(i + 4, true);
    const end = i + 8 + size + (size % 2);
    if (end > riffEnd) throw unreadable();
    if (i === 12 && !["VP8 ", "VP8L", "VP8X"].includes(type)) throw unreadable();
    if (type === "VP8 " || type === "VP8L" || type === "ANMF") image = true;
    if (type === "VP8X") {
      if (size < 10) throw unreadable();
      const chunk = b.slice(i, end);
      chunk[8] &= ~(EXIF_FLAG | XMP_FLAG);
      keep.push(chunk);
    } else if (type !== "EXIF" && type !== "XMP ") keep.push(b.subarray(i, end));
    i = end;
  }
  if (!image) throw unreadable();
  const body = join([b.subarray(8, 12), ...keep]);
  const head = new Uint8Array(8);
  head.set(b.subarray(0, 4));
  new DataView(head.buffer).setUint32(4, body.length, true);
  return join([head, body]);
}

/**
 * The image without its metadata, same type, every other byte unchanged. Throws (400) on anything that doesn't
 * parse as a whole JPEG, PNG or WebP, so a malformed file is never stored as it was sent.
 */
export function stripMetadata(bytes: Uint8Array): Uint8Array {
  const at = (i: number, ...sig: number[]) => sig.every((s, j) => bytes[i + j] === s);
  if (at(0, 0xff, 0xd8)) return jpeg(bytes);
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return png(bytes);
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return webp(bytes);
  throw unreadable();
}

/** JPEG: the frame header's size (any SOFn; not DHT C4, JPG C8 or DAC CC), or null if a scan comes first. */
function jpegSize(b: Uint8Array): { width: number; height: number } | null {
  for (let i = 2; i + 3 < b.length; ) {
    if (b[i] !== 0xff) return null;
    const m = b[i + 1];
    if (m === 0xff) { i++; continue; }
    if (m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
    if (m === 0xd9 || m === 0xda) return null;
    const length = (b[i + 2] << 8) | b[i + 3];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      if (length < 7 || i + 9 > b.length) return null;
      return { height: (b[i + 5] << 8) | b[i + 6], width: (b[i + 7] << 8) | b[i + 8] };
    }
    if (length < 2) return null;
    i += 2 + length;
  }
  return null;
}

/** WebP: the VP8X canvas, or the size in the first VP8 (lossy) or VP8L (lossless) bitstream's header. */
function webpSize(b: Uint8Array): { width: number; height: number } | null {
  if (b.length < 25) return null;
  const type = ascii(b, 12);
  if (type !== "VP8L" && b.length < 30) return null;
  const u24 = (at: number) => b[at] | (b[at + 1] << 8) | (b[at + 2] << 16);
  if (type === "VP8X") return { width: u24(24) + 1, height: u24(27) + 1 };
  if (type === "VP8 ") {
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
    return { width: (b[26] | (b[27] << 8)) & 0x3fff, height: (b[28] | (b[29] << 8)) & 0x3fff };
  }
  if (type === "VP8L") {
    if (b[20] !== 0x2f) return null;
    const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  return null;
}

/**
 * The image's stored width and height in pixels (before any Exif turn), read from its header; null when the header
 * can't be read or says zero.
 */
export function imageSize(bytes: Uint8Array): { width: number; height: number } | null {
  const at = (i: number, ...sig: number[]) => sig.every((s, j) => bytes[i + j] === s);
  let size: { width: number; height: number } | null = null;
  if (at(0, 0xff, 0xd8)) size = jpegSize(bytes);
  else if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a) && bytes.length >= 24 && ascii(bytes, 12) === "IHDR") {
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    size = { width: v.getUint32(16), height: v.getUint32(20) };
  } else if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) size = webpSize(bytes);
  return size && size.width > 0 && size.height > 0 ? size : null;
}
