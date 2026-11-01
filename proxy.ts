import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { SESSION_OPTIONS, SessionData } from "@/lib/session-options";
import { originAllowed } from "@/lib/origin";
import { HOST_REFUSED, allowedHostNames, hostAllowed, withHostNames } from "@/lib/host-guard";
import { readHostNames } from "@/lib/host-names";
import { isHostMode } from "@/lib/edition";
import { WRITES_PER_MINUTE, bodyTooBig } from "@/lib/limits";
import { makeLimiter } from "@/lib/shared-limits";
import { PICTURE_CSP, buildCsp, isPicturePath, makeNonce } from "@/lib/csp";
import { hiddenIn } from "@/lib/edition-features";
import { SNAKE_PATH, showsGameWhenLocked } from "@/lib/quick-exit-core";

// Writes per person in a minute, counted in Redis so every server shares the count (each server counts alone when Redis is not set up).
const writes = makeLimiter("writes", WRITES_PER_MINUTE, 60_000);

// The quick exit's game and its score are open too (lib/quick-exit-core.ts): they are shown to a browser that the quick exit has signed out.
const PUBLIC_PATHS = ["/login", "/api/auth/login", "/privacy", "/join", "/api/auth/join", "/recover", "/api/auth/recover", "/setup", "/api/setup", "/help", SNAKE_PATH, "/api/snake", "/api/auth/quick-exit"];

// Routes that only read but take a POST, so the words searched for stay out of addresses and server logs. They change
// nothing, so they do not count as writes (the search window asks once per pause in typing).
const READS_BY_POST = ["/api/search"];

// Names this copy answers to, when it is a local copy or ALLOWED_HOSTS is set (lib/host-guard.ts); null means anyone. A leader's copy (host mode)
// also answers to the names saved on its /host page, read through a cache of a few seconds (lib/host-names.ts).
const allowedHosts = allowedHostNames();
const hostMode = isHostMode();

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // A page on another domain that points its name at this computer (DNS rebinding) arrives with that name in Host and is refused first.
  // The one request with no Host at all is Next.js's image optimizer reading a picture from this same server (a mocked request with no
  // headers): a browser always sends Host, so a read with none is let through, and a change with none is still refused.
  const internalRead = request.headers.get("host") === null && (request.method === "GET" || request.method === "HEAD");
  if (!internalRead && !hostAllowed(request.headers.get("host"), hostMode ? withHostNames(allowedHosts, readHostNames().names) : allowedHosts)) {
    return new NextResponse(HOST_REFUSED, { status: 421, headers: { "content-type": "text/plain; charset=utf-8" } });
  }

  // A page on another website cannot make this app change anything, even for a signed-in browser.
  if (!originAllowed(request.method, request.headers, request.nextUrl.host)) {
    return pathname.startsWith("/api/")
      ? NextResponse.json({ error: "Forbidden" }, { status: 403 })
      : new NextResponse("Forbidden", { status: 403 });
  }

  // A copy that runs on one person's computer has no forum, circle, invite or user-management pages: they are absent, not hidden behind a switch.
  if (hiddenIn(process.env.DS_EDITION, pathname)) {
    return pathname.startsWith("/api/")
      ? NextResponse.json({ error: "Not found" }, { status: 404 })
      : new NextResponse("Not found", { status: 404 });
  }

  if (bodyTooBig(pathname, request.headers.get("content-length"))) {
    return NextResponse.json({ error: "That is too much to send at once." }, { status: 413 });
  }

  // Every page gets a fresh nonce, and scripts run only with it (lib/csp.ts). The policy goes in the request too, which is how Next.js finds the
  // nonce to stamp on its own scripts, and the nonce in x-nonce for the layout's own inline script. Whatever a client sent under those names is replaced.
  const nonce = makeNonce();
  const csp = buildCsp(nonce, process.env.NODE_ENV === "development");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const pass = () => {
    const next = NextResponse.next({ request: { headers: requestHeaders } });
    // A picture route gets the sandbox policy here, because this header replaces whatever the route sets.
    next.headers.set("Content-Security-Policy", isPicturePath(pathname) ? PICTURE_CSP : csp);
    return next;
  };

  // A browser the quick exit locked (lib/quick-exit-core.ts) is shown the snake game for every page, the sign-in page included, until the
  // high-score name unlocks it. Only a browser that has a session cookie can be locked, so the cookie is read only then.
  if (showsGameWhenLocked(pathname) && request.cookies.has(SESSION_OPTIONS.cookieName)) {
    const peek = await getIronSession<SessionData>(request, NextResponse.next(), SESSION_OPTIONS);
    if (peek.decoy && !peek.userId) {
      const game = NextResponse.rewrite(new URL(SNAKE_PATH, request.url), { request: { headers: requestHeaders } });
      game.headers.set("Content-Security-Policy", csp);
      return game;
    }
  }

  // Always allow public paths and static assets
  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    // Card pictures only; the /cards/[id] pages are for signed-in people like every other page.
    /^\/cards\/[^/]+\.(jpe?g|png|webp)$/i.test(pathname) ||
    pathname === "/favicon.ico" ||
    pathname === "/sw.js" ||
    pathname === "/manifest.webmanifest"
  ) {
    return pass();
  }

  // Claude API routes use X-Claude-Key header — skip session check
  if (pathname.startsWith("/api/claude/")) {
    return pass();
  }

  // The picture studio's routes use its own worker token (Authorization: Bearer dsw_...), checked by requireWorker in every handler.
  if (pathname.startsWith("/api/worker/")) {
    return pass();
  }

  const response = pass();
  const session = await getIronSession<SessionData>(request, response, SESSION_OPTIONS);

  if (!session.userId) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Writes are limited per person so one account (or a loop in a script) cannot fill the database or hammer the server.
  if (
    request.method !== "GET" &&
    request.method !== "HEAD" &&
    !READS_BY_POST.includes(pathname) &&
    !(await writes.allow(`u${session.userId}`))
  ) {
    return pathname.startsWith("/api/")
      ? NextResponse.json({ error: "Slow down a little: too many changes in a minute. Try again shortly." }, { status: 429 })
      : new NextResponse("Too many requests", { status: 429 });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
