import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { createUser, deleteUser } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { clearLoginFailures, clientIp, ipKey, isLoginLimited, recordLoginFailure } from "@/lib/login-limit";
import { ACCOUNTS_FULL, mayJoin } from "@/lib/account-cap-core";
import { claimInvite, joinProblem, looksLikeCode, normalizeCode, recordInviteUse, releaseInvite } from "@/lib/invites";
import { joinCircle, markCodeMadeAccount, peekCircleCode } from "@/lib/circles";
import { CIRCLE_ACCOUNTS_FULL, CIRCLE_PROBLEMS, circleMayMakeAccount } from "@/lib/circles-core";
import { maxCircleMembers } from "@/lib/circle-limits";
import { familyCircleAllowed, familyGateRequired } from "@/lib/family-access-core";

const BAD_CODE = "That code does not work. It may have been used, revoked, or have expired.";
const NAME_TAKEN = "That username is taken. Choose another.";

// Makes an account from an invite code, or from a circle's code (the person then joins that circle in the same step; ED5). Wrong codes are
// rate-limited (apart from sign-in's own limit); a good code works once.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const code = normalizeCode(body.code);
  const keys = { ip: ipKey("join-ip", clientIp(request.headers)), user: `join-code:${code.slice(0, 12)}` };

  if (await isLoginLimited(keys)) return Response.json({ error: "Too many tries. Try again later." }, { status: 429 });

  const problem = joinProblem(body.username, body.password, body.displayName);
  if (problem) return Response.json({ error: problem }, { status: 400 });
  const username = (body.username as string).trim();
  const displayName = typeof body.displayName === "string" && body.displayName.trim() ? body.displayName.trim() : null;

  // A ceiling on accounts (MAX_ACCOUNTS), checked before the code is used so a full copy does not burn anyone's code.
  const count = await queryOne<{ n: number }>("SELECT COUNT(*)::int AS n FROM users");
  if (!mayJoin(count?.n ?? 0)) return Response.json({ error: ACCOUNTS_FULL }, { status: 503 });

  const familyOnly = familyGateRequired();
  const inviteId = !familyOnly && looksLikeCode(code) ? await claimInvite(code) : null;

  // Not one of the owner's invite codes: it may be a circle's code. Looking at it does not use it up.
  let circle: { circle_id: number; circle_name: string } | null = null;
  if (!inviteId && looksLikeCode(code)) {
    const peeked = await peekCircleCode(code);
    if (peeked && familyCircleAllowed(peeked.circle_id)) {
      if (!circleMayMakeAccount(peeked.made, maxCircleMembers())) return Response.json({ error: CIRCLE_ACCOUNTS_FULL }, { status: 403 });
      // The notice of what goes where must be agreed to before anything is made, as when a person with an account joins.
      if (body.agreed !== true) {
        return Response.json({ error: CIRCLE_PROBLEMS.not_agreed.error, needsAgreement: true, circle: peeked.circle_name }, { status: 400 });
      }
      circle = peeked;
    }
  }
  if (!inviteId && !circle) {
    await recordLoginFailure(keys);
    return Response.json({ error: BAD_CODE }, { status: 403 });
  }

  // Only someone holding a good code learns whether a name is taken (the code is checked first, so names cannot be probed without one).
  // A name that differs only by capitals is the same name to the people reading the forum.
  const taken = await queryOne("SELECT 1 FROM users WHERE LOWER(username) = LOWER($1)", [username]);
  if (taken) {
    if (inviteId) await releaseInvite(inviteId);
    return Response.json({ error: NAME_TAKEN }, { status: 409 });
  }

  let user;
  try {
    user = await createUser(username, displayName, body.password as string, false);
  } catch {
    if (inviteId) await releaseInvite(inviteId);
    return Response.json({ error: NAME_TAKEN }, { status: 409 });
  }

  if (inviteId) {
    await recordInviteUse(inviteId, user.id);
  } else {
    // The code is used up only if the person really joins the circle. If it cannot (used a moment ago by someone else, or the circle is
    // full), the account just made is removed again, so a failed try leaves nothing behind.
    const joined = await joinCircle(user.id, code, true);
    if (!joined.ok) {
      await deleteUser(user.id);
      if (joined.problem === "bad_code") {
        await recordLoginFailure(keys);
        return Response.json({ error: BAD_CODE }, { status: 403 });
      }
      return Response.json({ error: CIRCLE_PROBLEMS[joined.problem].error }, { status: CIRCLE_PROBLEMS[joined.problem].status });
    }
    await markCodeMadeAccount(code, user.id);
  }
  await clearLoginFailures(keys);

  const session = await getSession();
  session.userId = user.id;
  session.username = user.username;
  session.isAdmin = false;
  session.sv = user.session_version ?? 0;
  await session.save();

  // A new account has not read the privacy and terms text yet, so the page takes them to it.
  return Response.json({ ok: true, username: user.username, privacyNeeded: true }, { status: 201 });
}
