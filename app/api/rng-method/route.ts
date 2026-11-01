import { getSession } from "@/lib/session";
import { queryOne, query } from "@/lib/db";
import { FEATHERED } from "@/lib/edition";

// random.org is on the internet, so the Feathered edition does not offer it (docs/plan-feathered-edition.md).
const VALID_METHODS = FEATHERED ? ["math", "crypto"] : ["math", "crypto", "random.org"];

export async function GET() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const row = await queryOne<{ rng_method: string | null }>(
    "SELECT rng_method FROM users WHERE id = $1",
    [session.userId]
  );

  const method = row?.rng_method ?? "math";
  return Response.json({ method: VALID_METHODS.includes(method) ? method : "crypto" });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { method: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!VALID_METHODS.includes(body.method)) {
    return Response.json({ error: "Invalid method" }, { status: 400 });
  }

  await query("UPDATE users SET rng_method = $1 WHERE id = $2", [body.method, session.userId]);

  return Response.json({ ok: true });
}
