import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

// The page policy refuses style="..." attributes (lib/csp.ts, open item S4), so a `style={...}` prop in a component would silently not apply in
// production: the server writes it into the page's HTML and the browser ignores it. Fixed values belong in classes, and values that come from the
// person's data go through `styleRef` / `<Styled>` (lib/apply-style.ts), which set them from script.

const ROOT = process.cwd();
const FOLDERS = ["app", "components"];
// The old tower map is not part of the app (its README says so).
const SKIP = [path.join("components", "archive")];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (SKIP.some((s) => p.endsWith(s) || p.includes(s + path.sep))) return [];
    if (e.isDirectory()) return sourceFiles(p);
    return /\.(tsx|ts)$/.test(e.name) ? [p] : [];
  });
}

test("no component writes a style attribute (use classes, styleRef or <Styled>)", () => {
  const found: string[] = [];
  for (const folder of FOLDERS) {
    for (const file of sourceFiles(path.join(ROOT, folder))) {
      readFileSync(file, "utf8").split(/\r?\n/).forEach((line, i) => {
        if (/\bstyle=\{/.test(line) || /\bstyle="/.test(line) || /setAttribute\(\s*["']style["']/.test(line) || /\.style\.cssText\s*=/.test(line)) {
          found.push(`${path.relative(ROOT, file)}:${i + 1}: ${line.trim().slice(0, 100)}`);
        }
      });
    }
  }
  assert.deepEqual(found, [], `style attributes are refused by the page policy:\n${found.join("\n")}`);
});

test("next/image with fill is not used (it writes a style attribute): FillImage takes its place", () => {
  const found: string[] = [];
  for (const folder of FOLDERS) {
    for (const file of sourceFiles(path.join(ROOT, folder))) {
      const text = readFileSync(file, "utf8");
      if (/from ["']next\/image["']/.test(text) && !/getImageProps/.test(text)) found.push(path.relative(ROOT, file));
    }
  }
  assert.deepEqual(found, [], `import getImageProps and leave the style off, as components/ui/FillImage.tsx does:\n${found.join("\n")}`);
});
