import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

// proxy.ts turns away signed-out requests, but a proxy can be bypassed (Next.js has had several such bugs), so every API
// handler must also check for itself who is asking. This reads each route file and fails when a handler has no check.

const API = path.join(process.cwd(), "app", "api");

/** Routes anyone may call: signing in, joining with a code, signing out, setting a new password with a recovery code, signing in with a passkey, and the first-run set-up of a local copy (refused once an account exists). */
// auth/quick-exit and snake/score serve the quick exit's game (lib/quick-exit-core.ts): a browser the quick exit signed out must reach them.
const PUBLIC = new Set(["auth/login", "auth/login/passkey", "auth/login/passkey/options", "auth/join", "auth/logout", "auth/recover", "setup", "auth/quick-exit", "snake/score"]);

/** Ways a handler shows it checked who is asking: the session with a refusal, a shared helper, the Claude tool key, or a worker token. */
const CHECKS = [
  /if \(!session\.userId\b/,
  /if \(!session\?\.userId\b/,
  /!session\.userId \|\|/,
  /\brequireUser\(/,
  /\brequireAdmin\(/,
  /\bgetClaudeApiUserId\(/,
  /\baiGate\(session\.userId/,
  // The Claude routes get their client and their permission together; it answers 401 itself when no one is signed in.
  /\bclaudeAccess\(session\.userId/,
  // The picture-maker's own helper (app/api/oracle/image-tool), which also checks the Settings switch.
  /= await allowed\(\);\s+if \(who instanceof Response\)/,
  // The picture studio's routes (app/api/worker), which take the studio's own token instead of a session.
  /= await requireWorker\(request(, "(pictures|companion)")?\);\s+if \(worker instanceof Response\) return worker;/,
];

function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? routeFiles(path.join(dir, e.name)) : e.name === "route.ts" ? [path.join(dir, e.name)] : []
  );
}

test("every API handler checks who is asking, apart from sign-in, joining and sign-out", () => {
  const missing: string[] = [];
  for (const file of routeFiles(API)) {
    const route = path.relative(API, path.dirname(file)).split(path.sep).join("/");
    if (PUBLIC.has(route)) continue;
    const source = readFileSync(file, "utf8");
    const handlers = source.split(/export async function (?=GET|POST|PUT|PATCH|DELETE)/).slice(1);
    for (const body of handlers) {
      const name = body.slice(0, body.indexOf("("));
      // A handler may hand the check to a helper defined in the same file (for example requireAdmin at the top).
      if (!CHECKS.some((re) => re.test(body))) missing.push(`${route} ${name}`);
    }
  }
  assert.deepEqual(missing, [], `handlers with no sign-in check of their own:\n${missing.join("\n")}`);
});

test("the service worker never stores pages, only the shared card pictures", () => {
  const sw = readFileSync(path.join(process.cwd(), "public", "sw.js"), "utf8");
  assert.doesNotMatch(sw, /cache\.addAll/, "nothing is stored when the worker installs");
  assert.doesNotMatch(sw, /"\/readings"|"\/journals"|"\/spreads"/, "no private page is named for storing");
  // The only cache.put is the one for card pictures.
  assert.equal(sw.match(/cache\.put/g)?.length ?? 0, 1);
});
