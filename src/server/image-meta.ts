// Strips location-bearing metadata (Exif, XMP, IPTC, text chunks) from an uploaded image before it is stored.
// Walks each format's own container and copies every other byte as it was; pixels are never decoded.
import { AccessError } from "./guard";

const unreadable = () => new AccessError("That image couldn’t be read. Please choose another JPG, PNG or WebP.", 400);
const ascii = (b: Uint8Array, at: number) => String.fromCharCode(b[at], b[at + 1], b[at + 2], b[at + 3]);
const join = (parts: Uint8Array[]) => new Uint8Array(Buffer.concat(parts));

/** JPEG: drops APP1 (Exif, XMP) and APP13 (Photoshop/IPTC) segments and anything after end-of-image. */
function jpeg(b: Uint8Array): Uint8Array {
  const keep: Uint8Array[] = [b.subarray(0, 2)];
  let i = 2;
  let scanned = false;
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
