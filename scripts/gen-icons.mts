// Draws the app icons from the app's sigil (lib/app-sigil-core.ts): public/icon-192.png, public/icon-512.png (maskable, so
// the sigil keeps inside the middle circle a phone may crop to) and app/favicon.ico (16, 32 and 48 px, with a heavier pen).
// Run: npx tsx scripts/gen-icons.mts
import sharp from "sharp";
import { writeFileSync } from "fs";
import { APP_SIGIL_DOTS, APP_SIGIL_FILLS, APP_SIGIL_LINE_RATIO, APP_SIGIL_RAYS, APP_SIGIL_STROKE, APP_SIGIL_STROKES, APP_SIGIL_TRANSFORM, APP_SIGIL_VIEWBOX } from "../lib/app-sigil-core";

const CANVAS = "#0d0d1a"; // --color-canvas
const INK = "#c4b5fd"; // purple-300, the colour of the app's name on the sign-in page

/** The icon as SVG: a dark square (rounded unless it is maskable) with the sigil centred, `scale` of the side wide. */
function makeSvg(size: number, { scale, stroke = APP_SIGIL_STROKE, rounded = true }: { scale: number; stroke?: number; rounded?: boolean }) {
  const k = (size * scale) / APP_SIGIL_VIEWBOX;
  const offset = (size - size * scale) / 2;
  const sigil = [
    ...APP_SIGIL_FILLS.map((d) => `<path d="${d}" fill="${INK}" stroke="none"/>`),
    ...APP_SIGIL_STROKES.map((d) => `<path d="${d}" stroke-width="${stroke * APP_SIGIL_LINE_RATIO}"/>`),
    `<path d="${APP_SIGIL_RAYS}"/>`,
    ...APP_SIGIL_DOTS.map(({ cx, cy, r }) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${INK}" stroke="none"/>`),
  ].join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${rounded ? size * 0.18 : 0}" fill="${CANVAS}"/>
  <g transform="translate(${offset} ${offset}) scale(${k})" fill="none" stroke="${INK}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"><g transform="${APP_SIGIL_TRANSFORM}">${sigil}</g></g>
</svg>`;
}

const png = (svg: string) => sharp(Buffer.from(svg)).png().toBuffer();

writeFileSync("public/icon-192.png", await png(makeSvg(192, { scale: 0.78 })));
console.log("✓ public/icon-192.png");
writeFileSync("public/icon-512.png", await png(makeSvg(512, { scale: 0.62, rounded: false })));
console.log("✓ public/icon-512.png");

// An .ico file is a small header, one 16-byte entry per picture, then the pictures themselves as PNG.
const favicons = await Promise.all(
  [16, 32, 48].map(async (size) => ({ size, data: await png(makeSvg(size, { scale: 0.94, stroke: size <= 16 ? 3.4 : size <= 32 ? 3.2 : 3 })) })),
);
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(favicons.length, 4);
let offset = 6 + 16 * favicons.length;
const entries = favicons.map(({ size, data }) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(size, 0);
  e.writeUInt8(size, 1);
  e.writeUInt16LE(1, 4);
  e.writeUInt16LE(32, 6);
  e.writeUInt32LE(data.length, 8);
  e.writeUInt32LE(offset, 12);
  offset += data.length;
  return e;
});
writeFileSync("app/favicon.ico", Buffer.concat([header, ...entries, ...favicons.map((f) => f.data)]));
console.log("✓ app/favicon.ico");
