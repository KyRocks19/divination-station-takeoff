import { NextRequest } from "next/server";
import { queryOne } from "./db";
import { verifyClaudeKey } from "./auth";
import { personalTokenFrom } from "./claude-tokens-core";
import { userIdForClaudeToken } from "./claude-tokens";
import { familyUserAllowed } from "./family-access";

/**
 * Authenticate a machine-to-machine request under /api/claude/** and return the one user it acts for.
 *
 * A person's own token (`dsc_...`, made in Settings) acts for the account that made it and nothing else; it needs no other header.
 * The older shared CLAUDE_API_KEY still works, for accounts an admin has switched on (users.claude_access): each request names the
 * account in the `x-claude-user` header (a username, capitals ignored); when the header is absent, CLAUDE_API_USER or the first admin
 * account is used. Prefer personal tokens: the shared key can reach every switched-on account.
 * Every /api/claude route must scope its queries to the returned id.
 */
export async function getClaudeApiUserId(request: NextRequest): Promise<number | null> {
  const personal = personalTokenFrom(request.headers);
  if (personal) {
    const userId = await userIdForClaudeToken(personal);
    return userId !== null && (await familyUserAllowed(userId)) ? userId : null;
  }

  if (!verifyClaudeKey(request.headers.get("x-claude-key") ?? "")) return null;

  const username = request.headers.get("x-claude-user")?.trim() || process.env.CLAUDE_API_USER?.trim();
  const user = username
    ? await queryOne<{ id: number }>(
        "SELECT id FROM users WHERE LOWER(username) = LOWER($1) AND claude_access = 1 ORDER BY (username = $1) DESC, id ASC LIMIT 1",
        [username]
      )
    : await queryOne<{ id: number }>(
        "SELECT id FROM users WHERE is_admin = 1 AND claude_access = 1 ORDER BY id ASC LIMIT 1"
      );
  return user?.id && (await familyUserAllowed(user.id)) ? user.id : null;
}
