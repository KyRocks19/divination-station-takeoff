// Checks on a running copy that a picture answer carries the sandbox policy (open item E9; proxy.ts sets it on these paths),
// so a picture opened on its own address cannot run anything. Makes one set, one item with a blank drawing and one gallery
// picture for the signed-in account, checks, and deletes all three.
//
// Start a local copy as for scripts/smoke-pages.mts, then: npx tsx scripts/check-sandbox-headers.mts [--url http://localhost:3101]
// Uses the same account as the smoke test (SMOKE_USER, SMOKE_PASSWORD).
import { request } from "@playwright/test";
import { PICTURE_CSP } from "../lib/csp";

const i = process.argv.indexOf("--url");
const base = (i > 0 ? process.argv[i + 1] : "http://localhost:3101").replace(/\/$/, "");
const user = process.env.SMOKE_USER ?? "smoke-tester";
const password = process.env.SMOKE_PASSWORD ?? "smoke-tester-passphrase-1";
// A 1 by 1 pixel PNG.
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

async function main() {
  const api = await request.newContext({ baseURL: base, extraHTTPHeaders: { Origin: base } });
  const problems: string[] = [];
  const ok = async (what: string, res: Awaited<ReturnType<typeof api.get>>) => {
    if (!res.ok()) throw new Error(`${what}: ${res.status()} ${await res.text()}`);
    return res.json();
  };
  await ok("sign in", await api.post("/api/auth/login", { data: { username: user, password } }));
  const deck = await ok("make a set", await api.post("/api/oracle/decks", { data: { name: "Sandbox header check" } }));
  try {
    const card = await ok("make an item", await api.post("/api/oracle/cards", { data: { name: "Check", deck_id: deck.id } }));
    await ok("draw", await api.put(`/api/oracle/cards/${card.id}/art`, { data: { kind: "drawing", drawing: { background: "#000000", strokes: [] } } }));
    const pic = await ok("add to the gallery", await api.post("/api/oracle/gallery", { data: { image: PNG, alt: "A dot" } }));
    try {
      for (const [what, path] of [["an item's picture", `/api/oracle/cards/${card.id}/art`], ["a gallery picture", `/api/oracle/gallery/${pic.id}`]]) {
        const res = await api.get(path);
        const policies = res.headersArray().filter((h) => h.name.toLowerCase() === "content-security-policy").map((h) => h.value);
        const joined = policies.join(" , ");
        process.stdout.write(`${what}: ${res.status()}, ${policies.length} policy header(s)\n`);
        if (!res.ok()) problems.push(`${what}: status ${res.status()}`);
        if (!joined.includes(PICTURE_CSP)) problems.push(`${what}: the sandbox policy is missing`);
        // The page policy's script rule would loosen nothing (every policy must pass), but its presence means the proxy is not choosing.
        if (/script-src/.test(joined)) problems.push(`${what}: the page policy arrived too`);
      }
    } finally {
      await api.delete(`/api/oracle/gallery/${pic.id}`);
    }
  } finally {
    await api.delete(`/api/oracle/decks/${deck.id}`);
  }
  await api.dispose();
  process.stdout.write(problems.length ? `PROBLEMS:\n  ${problems.join("\n  ")}\n` : "Both picture routes answer with the sandbox policy.\n");
  process.exitCode = problems.length ? 1 : 0;
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
