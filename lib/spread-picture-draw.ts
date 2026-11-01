// Paints a spread picture's plan (lib/spread-picture-core.ts) onto a canvas. Browser only: it needs a canvas and loads the card pictures from this site's own
// /cards folder, so nothing is sent anywhere and the canvas is never tainted. The colours are fixed, not the person's theme, so the picture looks the same wherever it is shared.

import { APP_SIGIL_DOTS, APP_SIGIL_FILLS, APP_SIGIL_LINE_RATIO, APP_SIGIL_RAYS, APP_SIGIL_STROKE, APP_SIGIL_STROKES, APP_SIGIL_TRANSFORM, APP_SIGIL_VIEWBOX } from "./app-sigil-core";
import type { PicturePlan, PlacedCard } from "./spread-picture-core";

const INK = "#f3eefc";
const MUTED = "#c9bde6";
const BACKGROUND = "#17132b";
const CARD_BOX = "#241d45";
const FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif";

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** The app's sigil (lib/app-sigil-core.ts), `size` across, centred on the current origin: a card with no picture shows it. */
function drawSigil(ctx: CanvasRenderingContext2D, size: number, color: string) {
  const [, tx, ty, k] = APP_SIGIL_TRANSFORM.match(/translate\(([\d.]+) ([\d.]+)\) scale\(([\d.]+)\)/)!.map(Number);
  ctx.save();
  ctx.scale(size / APP_SIGIL_VIEWBOX, size / APP_SIGIL_VIEWBOX);
  ctx.translate(-APP_SIGIL_VIEWBOX / 2 + tx, -APP_SIGIL_VIEWBOX / 2 + ty);
  ctx.scale(k, k);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const d of APP_SIGIL_FILLS) ctx.fill(new Path2D(d));
  ctx.lineWidth = APP_SIGIL_STROKE * APP_SIGIL_LINE_RATIO;
  for (const d of APP_SIGIL_STROKES) ctx.stroke(new Path2D(d));
  ctx.lineWidth = APP_SIGIL_STROKE;
  ctx.stroke(new Path2D(APP_SIGIL_RAYS));
  for (const { cx, cy, r } of APP_SIGIL_DOTS) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCard(ctx: CanvasRenderingContext2D, c: PlacedCard, img: HTMLImageElement | null) {
  const cx = c.x + c.w / 2;
  const cy = c.y + c.h / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((c.rotation * Math.PI) / 180);
  // A card drawn upside down is shown upside down, as on the reading's page.
  if (c.reversed) ctx.rotate(Math.PI);
  roundRect(ctx, -c.w / 2, -c.h / 2, c.w, c.h, 12);
  ctx.fillStyle = CARD_BOX;
  ctx.fill();
  if (img) {
    ctx.save();
    ctx.clip();
    // Fill the card with the picture, cropping the overflow (the same as "slice" on the reading's page).
    const scale = Math.max(c.w / img.width, c.h / img.height);
    ctx.drawImage(img, -(img.width * scale) / 2, -(img.height * scale) / 2, img.width * scale, img.height * scale);
    ctx.restore();
  } else {
    drawSigil(ctx, 30, MUTED);
  }
  roundRect(ctx, -c.w / 2, -c.h / 2, c.w, c.h, 12);
  ctx.strokeStyle = c.color;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();
}

/** Draws the plan onto the canvas, sizing it to the plan. Resolves when every picture has loaded or failed (a card whose picture will not load is drawn as a plain box). */
export async function drawSpreadPicture(plan: PicturePlan, canvas: HTMLCanvasElement): Promise<void> {
  canvas.width = plan.width;
  canvas.height = plan.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const images = await Promise.all(plan.cards.map((c) => (c.file ? loadImage(`/cards/${c.file}`) : Promise.resolve(null))));

  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, plan.width, plan.height);
  ctx.textAlign = "center";

  ctx.fillStyle = INK;
  ctx.font = `700 44px ${FONT}`;
  for (const l of plan.title) ctx.fillText(l.text, l.x, l.y);
  if (plan.meta) {
    ctx.fillStyle = MUTED;
    ctx.font = `400 28px ${FONT}`;
    ctx.fillText(plan.meta.text, plan.meta.x, plan.meta.y);
  }
  ctx.fillStyle = INK;
  ctx.font = `italic 400 27px ${FONT}`;
  for (const l of plan.question) ctx.fillText(l.text, l.x, l.y);

  plan.cards.forEach((c, i) => {
    drawCard(ctx, c, images[i]);
    ctx.fillStyle = c.color;
    ctx.font = `600 20px ${FONT}`;
    for (const l of c.label) ctx.fillText(l.text, l.x, l.y);
    for (const l of c.below) {
      ctx.fillStyle = l.kind === "name" ? INK : MUTED;
      ctx.font = l.kind === "name" ? `600 25px ${FONT}` : `italic 400 21px ${FONT}`;
      ctx.fillText(l.text, l.x, l.y);
    }
  });
}

/** The canvas as a PNG file, or null if the browser would not make one. */
export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}
