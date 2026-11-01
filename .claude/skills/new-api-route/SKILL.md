---
name: new-api-route
description: Conventions for a new API route or page (auth check, DB access, response shape). Use when creating anything under app/api/ or a new page.tsx.
---

# New API route / page conventions

Also read `next16-docs` first (async `params`, proxy).

## Route handler template (`app/api/<thing>/route.ts`)
```ts
import { NextRequest } from "next/server";
import { queryOne } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  if (!body.name?.trim()) return Response.json({ error: "name is required" }, { status: 400 });
  const row = await queryOne("INSERT ... VALUES ($1, $2) RETURNING *", [session.userId, body.name.trim()]);
  return Response.json(row, { status: 201 });
}
```

## Rules
- Check `session.userId` in **every** handler (proxy.ts is a second layer, not a substitute).
- **Always scope by owner**: `WHERE user_id = $1` with `session.userId`, including UPDATE/DELETE on `[id]` routes.
- Admin-only: check `session.isAdmin`, return 403 `Forbidden` (see `app/api/admin/users/route.ts`).
- Machine-to-machine (Claude tool) routes live under `app/api/claude/**` and skip the session check in `proxy.ts`.
  Each handler must call `getClaudeApiUserId(request)` from `lib/claude-api.ts` (401 when it returns null; it resolves the `x-claude-user` header and checks `users.claude_access`) and scope
  every query to the returned id, exactly as session routes scope to `session.userId`.
- SQL: parameterized `$1...` only, via `query` / `queryOne` / `withTransaction` from `lib/db.ts`. No string interpolation.
- Errors: `Response.json({ error: "message" }, { status })`: 400 validation, 401 unauthenticated, 403 forbidden, 404 missing.
- Dynamic segments: `{ params }: { params: Promise<{ id: string }> }`, then `await params`.
- LLM calls: model names come from env (`INTERPRET_MODEL`, `GUIDE_MODEL`, `SWORD_MODEL`); never hardcode keys.
- New public path? Add it to `PUBLIC_PATHS` in `proxy.ts` deliberately; the default is authenticated.
- Pages: server components by default; add `"use client"` only for interactivity. Match the Tailwind v4 styling nearby.

After writing, run `pre-commit-check`.
