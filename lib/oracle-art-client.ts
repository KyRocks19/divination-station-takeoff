// Browser-only picture helpers for oracle art (used by the picture editor, the picture-maker, and the gallery).
import { limitsFor, type ArtLimits } from "./oracle-art";

/**
 * Shrinks a picture in the browser to at most `longest` pixels on its long side and returns it as a data address no
 * larger than the server accepts. Done here so a phone photo of several megabytes becomes a few hundred kilobytes
 * before it is sent, and so what is stored is always a plain JPEG or WebP the server can check.
 */
export async function shrinkImage(file: Blob, limits: ArtLimits = limitsFor(false)): Promise<string> {
  const { longest, maxBytes } = limits;
  const bitmap = await createImageBitmap(file);
  let scale = Math.min(1, longest / Math.max(bitmap.width, bitmap.height));
  for (let attempt = 0; attempt < 6; attempt++) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    // Larger limits (pictures kept on disk) keep more quality.
    const tries = maxBytes > 1_000_000
      ? ([["image/webp", 0.92], ["image/jpeg", 0.9], ["image/jpeg", 0.75]] as const)
      : ([["image/webp", 0.85], ["image/jpeg", 0.85], ["image/jpeg", 0.65]] as const);
    for (const [type, quality] of tries) {
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, type, quality));
      // toBlob falls back to PNG when a type is not supported; skip that answer and try the next type.
      if (blob && blob.type === type && blob.size <= maxBytes * 0.9) {
        bitmap.close();
        return await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        });
      }
    }
    scale *= 0.75;
  }
  bitmap.close();
  throw new Error("too large");
}

/**
 * Draws a stand-alone SVG (a saved drawing, see drawingToSvg) onto a canvas in the browser and returns it as a PNG, up to `longest` pixels on its
 * long side. The picture is made from the person's own strokes; nothing is sent anywhere. The result is then shrunk and sent like any upload, so a
 * drawing can be kept in the gallery as a picture. (createImageBitmap cannot read an SVG, so an <img> element does the drawing.)
 */
export async function svgToPngBlob(svgText: string, longest = 1600): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const w = img.naturalWidth || 512;
    const h = img.naturalHeight || 512;
    const scale = longest / Math.max(w, h);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("no picture");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * A data address as a Blob, so it can be shrunk. Decoded here, not with fetch(): the app's security policy only lets the
 * page call its own address (and the person's image tool), and a data address does not count as either.
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const match = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/i.exec(dataUrl);
  if (!match) throw new Error("not a picture");
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: match[1] });
}
