// Turns Natural Earth's 1:50m country borders and lakes into the small file the home page's world map loads (open item T10, decided 2026-10-18).
//
//   npx tsx scripts/build-world-map.ts <folder holding the two GeoJSON files> public/world/countries-50m.json
//
// The two source files are not kept in the repository (they are 4 MB between them, and public domain, so anyone can fetch them again):
//   https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson
//   https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_lakes.geojson
// Natural Earth is in the public domain ("Crediting the authors is unnecessary", https://www.naturalearthdata.com/about/terms-of-use/); the map says
// "Made with Natural Earth" anyway. The files this script was run on (2026-10-18) have these SHA-256 sums:
//   3e458fc036ad0a66411f2c1e6cac49c5d7bfb81cb1123bc513b22511a2b7fdeb  ne_50m_admin_0_countries.geojson
//   d350b75978b26fe839b797c2c529b2fb8f47fb3983c03f4964e36d5df9378a52  ne_50m_lakes.geojson
//
// What it does: puts every ring on the map's own flat picture (the same 1000-wide equirectangular picture lib/world-map-data.ts draws, from 84 degrees north
// to 57 south, so Antarctica is left out), thins each ring with the Douglas-Peucker rule to a tolerance far below what a person can see even at the
// highest zoom, rounds points to a tenth of a picture unit, and writes each country as one compact SVG path (a first point, then steps from point to point).
// Rings too small to show are left out. The JSON is only ever read as data.

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const WIDTH = 1000;
const LAT_TOP = 84;
const LAT_BOTTOM = -57;
const HEIGHT = Math.round((WIDTH * (LAT_TOP - LAT_BOTTOM)) / 360);
/** Points closer to a straight line than this (in picture units; 1 unit is a thousandth of the map's width) are dropped. At 8 times zoom it is under a pixel on most screens. */
const TOLERANCE = 0.1;
/** A ring whose box is smaller than this in both directions is too small to see even at the highest zoom. */
const MIN_SIZE = 0.25;

type Pt = [number, number];

const project = (lon: number, lat: number): Pt => {
  const la = Math.min(LAT_TOP, Math.max(LAT_BOTTOM, lat));
  return [((lon + 180) / 360) * WIDTH, ((LAT_TOP - la) / (LAT_TOP - LAT_BOTTOM)) * HEIGHT];
};

/** Douglas-Peucker, without recursion, on an open list of points. */
function simplify(points: Pt[], tolerance: number): Pt[] {
  if (points.length < 3) return points;
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let far = -1;
    let farDist = tolerance;
    const [ax, ay] = points[a];
    const [bx, by] = points[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = points[i];
      let d: number;
      if (len2 === 0) d = Math.hypot(px - ax, py - ay);
      else {
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
        d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
      }
      if (d > farDist) {
        farDist = d;
        far = i;
      }
    }
    if (far !== -1) {
      keep[far] = true;
      stack.push([a, far], [far, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** One ring as a path: the first point, then each step to the next, in tenths of a unit, closed. */
function ringPath(ring: Pt[]): string | null {
  const open = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring.slice(0, -1) : ring;
  const xs = open.map((p) => p[0]);
  const ys = open.map((p) => p[1]);
  if (Math.max(...xs) - Math.min(...xs) < MIN_SIZE && Math.max(...ys) - Math.min(...ys) < MIN_SIZE) return null;
  // A ring wholly south of the picture (Antarctica) is projected onto its bottom edge: leave it out.
  if (ys.every((y) => y >= HEIGHT - 1e-6)) return null;
  const thin = simplify(open, TOLERANCE);
  const q: [number, number][] = [];
  for (const [x, y] of thin) {
    const p: [number, number] = [Math.round(x * 10), Math.round(y * 10)];
    const last = q[q.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) q.push(p);
  }
  if (q.length < 3) return null;
  let out = `M${q[0][0] / 10},${q[0][1] / 10}l`;
  for (let i = 1; i < q.length; i++) out += `${i > 1 ? " " : ""}${q[i][0] - q[i - 1][0]} ${q[i][1] - q[i - 1][1]}`;
  // The steps are in tenths: scale is applied by writing them as decimals, so the path stays valid SVG without a transform.
  return out.replace(/l(.*)$/, (_, steps: string) => `l${steps.split(" ").map((n) => (Number(n) / 10).toString()).join(" ")}`) + "z";
}

interface Feature {
  properties: Record<string, unknown>;
  geometry: { type: string; coordinates: unknown } | null;
}

function ringsOf(f: Feature): Pt[][] {
  const g = f.geometry;
  if (!g) return [];
  const polygons = g.type === "Polygon" ? [g.coordinates as number[][][]] : g.type === "MultiPolygon" ? (g.coordinates as number[][][][]) : [];
  return polygons.flatMap((poly) => poly.map((ring) => ring.map(([lon, lat]) => project(lon, lat))));
}

const pathOf = (f: Feature) => ringsOf(f).map(ringPath).filter((p): p is string => !!p).join("");

function main() {
  const [folder, outFile] = process.argv.slice(2);
  if (!folder || !outFile) throw new Error("usage: build-world-map.ts <folder with the two GeoJSON files> <output .json>");
  const read = (name: string) => JSON.parse(readFileSync(join(folder, name), "utf8")) as { features: Feature[] };
  const countries = read("ne_50m_admin_0_countries.geojson").features
    .map((f) => ({
      n: String(f.properties.NAME_EN ?? f.properties.NAME ?? f.properties.ADMIN ?? ""),
      a: String(f.properties.ADM0_A3 ?? f.properties.ISO_A3 ?? ""),
      d: pathOf(f),
    }))
    .filter((c) => c.n && c.d);
  const lakes = read("ne_50m_lakes.geojson").features.map(pathOf).filter(Boolean).join("");
  const body = {
    version: 1,
    source: "Natural Earth 1:50m admin-0 countries and lakes (public domain), https://www.naturalearthdata.com/",
    width: WIDTH,
    height: HEIGHT,
    latTop: LAT_TOP,
    latBottom: LAT_BOTTOM,
    countries,
    lakes,
  };
  const text = JSON.stringify(body);
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, text);
  const sum = createHash("sha256").update(text).digest("hex");
  console.log(`${countries.length} countries, ${(text.length / 1024).toFixed(0)} KB, sha256 ${sum}`);
}

main();
