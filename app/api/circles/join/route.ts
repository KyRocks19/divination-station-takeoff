import { NextRequest } from "next/server";
import { requireUser } from "@/lib/own-http";
import { joinCircle } from "@/lib/circles";
import { looksLikeCode, normalizeCode } from "@/lib/invites";
import { clearLoginFailures, clientIp, ipKey, isLoginLimited, recordLoginFailure } from "@/lib/login-limit";
import { circleFailure } from "@/lib/circles-http";

// A signed-in person joins a circle with a code from its owner. Wrong codes are limited per address and per account (the same counters
// as signing in, under their own keys), so codes cannot be guessed.
export async function POST(request: NextRequest) {
  const who = await requireUser();
  if ("response" in who) return who.response;
  const keys = { ip: ipKey("circle-ip", clientIp(request.headers)), user: `circle-user:${who.userId}` };
  if (await isLoginLimited(keys)) return Response.json({ error: "Too many tries. Try again later." }, { status: 429 });

  const body = await request.json().catch(() => null);
  const code = normalizeCode(body?.code);
  // `agreed` is the box under "what goes where" (lib/circles-core.ts SHARING_NOTICE); nothing is used up without it.
  const result = looksLikeCode(code) ? await joinCircle(who.userId, code, body?.agreed === true) : ({ ok: false, problem: "bad_code" } as const);
  if (!result.ok) {
    if (result.problem === "bad_code") await recordLoginFailure(keys);
    return circleFailure(result)!;
  }
  await clearLoginFailures(keys);
  return Response.json({ ok: true, id: result.value });
}
