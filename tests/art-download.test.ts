// Checks on downloading a picture from the gallery or an item. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { attachmentHeader, downloadName } from "../lib/oracle-art";

test("the download name is made up from the kind, the number and the picture's type", () => {
  assert.equal(downloadName("gallery", 12, "image/webp"), "divination-station-gallery-12.webp");
  assert.equal(downloadName("item", 5, "image/jpeg"), "divination-station-item-5.jpg");
  assert.equal(downloadName("item", 5, "image/svg+xml; charset=utf-8"), "divination-station-item-5.svg");
  assert.equal(downloadName("item", 5, "image/png"), "divination-station-item-5.png");
  assert.equal(downloadName("item", NaN, "text/html"), "divination-station-item-0.bin", "an odd number or type gives a plain name");
});

test("the attachment header can hold no quote, slash or line break", () => {
  assert.equal(attachmentHeader("a.png"), 'attachment; filename="a.png"');
  const nasty = attachmentHeader('x"; filename="../../evil\r\n.html');
  assert.ok(!/[\r\n]/.test(nasty) && !nasty.includes("/") && nasty.split('"').length === 3, nasty);
});

test("both picture routes offer a download only when asked, keep the lock-down headers, and are still owner-scoped", () => {
  for (const file of ["app/api/oracle/gallery/[id]/route.ts", "app/api/oracle/cards/[id]/art/route.ts"]) {
    const src = readFileSync(path.join(__dirname, "..", file), "utf8");
    assert.ok(src.includes('searchParams.get("download") === "1"'), `${file}: ?download=1`);
    assert.ok(src.includes("attachmentHeader(downloadName("), `${file}: made-up file name`);
    assert.ok(src.includes('"X-Content-Type-Options": "nosniff"') && src.includes('"Content-Security-Policy": PICTURE_CSP'), `${file}: nosniff and sandbox stay`);
    assert.ok(/user_id = \$2/.test(src) || /a\.user_id = \$2/.test(src), `${file}: scoped to the person`);
  }
});
