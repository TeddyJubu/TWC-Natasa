// Shrinks a picked photo in the browser before it is uploaded, so a 4032px phone JPEG isn't stored (and later
// downloaded) for a 36px avatar. Decoding with `imageOrientation: "from-image"` turns the pixels upright, so the
// re-encoded file needs no Exif. No library: createImageBitmap, a canvas and toBlob. Anything the browser can't do
// leaves the file as it was, and the server's own checks (type, 5 MB, edge cap) still decide.

export type ResizeOptions = {
  /** The longest side, in pixels, the result may have. */
  maxEdge: number;
  /** Logos: keep transparency (WebP, else PNG) instead of falling back to JPEG. */
  keepAlpha?: boolean;
  /** A file already within `maxEdge` is still re-encoded when it is larger than this. */
  maxBytes?: number;
};

export const PORTRAIT_RESIZE: ResizeOptions = { maxEdge: 1600 };
export const LOGO_RESIZE: ResizeOptions = { maxEdge: 512, keepAlpha: true };
export const FEED_RESIZE: ResizeOptions = { maxEdge: 2048 };

const INPUT_TYPES = ["image/jpeg", "image/png", "image/webp"];
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
/** Bigger than any phone photo; past it, decoding could exhaust a phone's memory, so the file goes as it is. */
const MAX_INPUT_BYTES = 40 * 1024 * 1024;

/** `width` × `height` scaled down (never up) so the longest side is at most `maxEdge`. */
export function fitWithin(width: number, height: number, maxEdge: number): { width: number; height: number } {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

const encode = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob | null>((done) => canvas.toBlob(done, type, quality));

/**
 * The file, upright and at most `maxEdge` a side, as WebP (JPEG where the browser can't write WebP; PNG for a logo).
 * Returns the original when it is already small enough, isn't a JPEG/PNG/WebP, or can't be decoded or re-encoded.
 */
export async function resizeImage(file: File, { maxEdge, keepAlpha = false, maxBytes = 1024 * 1024 }: ResizeOptions): Promise<File> {
  if (!INPUT_TYPES.includes(file.type) || file.size > MAX_INPUT_BYTES || typeof createImageBitmap !== "function") return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, maxEdge);
    const scaled = width !== bitmap.width || height !== bitmap.height;
    // Small enough already: the server keeps a JPEG's Orientation, so it shows upright as it is.
    if (!scaled && file.size <= maxBytes) return file;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, width, height);
    let blob = await encode(canvas, "image/webp", keepAlpha ? 0.9 : 0.82);
    if (blob?.type !== "image/webp") {
      if (keepAlpha) blob = await encode(canvas, "image/png");
      else {
        // JPEG has no transparency: put white behind it rather than black.
        ctx.globalCompositeOperation = "destination-over";
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, width, height);
        blob = await encode(canvas, "image/jpeg", 0.85);
      }
    }
    if (!blob || !EXT[blob.type]) return file;
    if (!scaled && blob.size >= file.size) return file; // re-encoding only made it bigger
    const name = `${file.name.replace(/\.[^./]*$/, "") || "image"}.${EXT[blob.type]}`;
    return new File([blob], name, { type: blob.type, lastModified: file.lastModified });
  } finally {
    bitmap.close();
  }
}
