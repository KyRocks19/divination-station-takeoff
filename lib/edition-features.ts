import { FEATHERED, editionOf, isHostMode, type Edition } from "./edition";

// What a copy that runs on one person's own computer (DS_EDITION=local) does not have, because it needs a server shared by other people (open item ED9,
// docs/plan-editions.md). Absent, not switched off: the pages and routes answer "not found", and the navigation, the home page and the search do not list them.
// No database and no imports of the app, so the browser, the proxy and the tests use it.
//
// Kept on a local copy: the person's own tools, writings, Settings, backups, the admin log, and "Picture computers" (a person's own studio uses it).
// Left for later steps of the plan: the circle link (a person joins a circle's server from the full edition), Claude and picture access, young-folk mode (ED13).

/** Path prefixes a local copy answers "not found" to, pages and API alike. Matched on whole path segments: "/forum" covers "/forum/12" but not "/forums". */
export const LOCAL_HIDDEN_PREFIXES = [
  "/forum",
  "/api/forum",
  "/circle",
  "/api/circles",
  "/letters",
  "/api/letters",
  "/join",
  "/api/auth/join",
  "/feedback",
  "/api/feedback",
  "/admin/users",
  "/api/admin/users",
  "/api/admin/invites",
  "/api/admin/forum-reports",
] as const;

/** True when a request for this path must be answered "not found" on a local copy. */
export function hiddenInLocal(pathname: string): boolean {
  return LOCAL_HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/**
 * What a local copy in host mode (DS_MODE=host, docs/plan-host-mode.md) still leaves out: feedback goes to the people who make the app, and a leader's copy
 * is not theirs. The circle, forum, join, invite and user pages are on, because the leader's friends use them.
 */
export const HOST_HIDDEN_PREFIXES = ["/feedback", "/api/feedback"] as const;

/** True when a request for this path must be answered "not found" on a local copy in host mode. */
export function hiddenInHost(pathname: string): boolean {
  return HOST_HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/**
 * What the Feathered edition (docs/plan-feathered-edition.md) leaves out: everything a local copy for one person leaves out, and every AI feature
 * (Claude, the companion, the interviewer, the picture maker and the picture computers), and passkeys, which stay on the computer they were made on and
 * so do not travel on a flash drive. The AI code is not in the Feathered build at all; this makes its addresses answer "not found" too.
 */
export const FEATHERED_HIDDEN_PREFIXES = [
  ...LOCAL_HIDDEN_PREFIXES,
  "/ask",
  "/api/ask",
  "/journals/new",
  "/api/interpret",
  "/api/synthesize",
  "/api/claude",
  "/api/guide",
  "/api/insights/pattern",
  "/api/interview",
  "/api/companion",
  "/api/layouts/suggest-colors",
  "/api/oracle/image-jobs",
  "/api/oracle/image-tool",
  "/api/oracle/styles",
  "/api/worker",
  "/admin/workers",
  "/api/admin/workers",
  "/api/passkeys",
  "/api/auth/login/passkey",
] as const;

/** True when a request for this path must be answered "not found" in the Feathered edition. */
export function hiddenInFeathered(pathname: string): boolean {
  // A concept's description route stays: removing one Claude wrote earlier is not an AI feature. Its POST refuses in Feathered.
  return FEATHERED_HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/** The same question for the edition at hand: always false on a hosted copy; a local copy in host mode hides less than a local copy for one person. */
export function hiddenIn(edition: Edition | string | undefined, pathname: string, mode: string | undefined = process.env.DS_MODE, feathered = FEATHERED): boolean {
  if (feathered) return hiddenInFeathered(pathname);
  if (editionOf(edition, false) !== "local") return false;
  return isHostMode(mode, edition, false) ? hiddenInHost(pathname) : hiddenInLocal(pathname);
}
