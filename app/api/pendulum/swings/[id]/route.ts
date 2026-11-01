import { NextRequest } from "next/server";
import { withTransaction } from "@/lib/db";
import { getSession } from "@/lib/session";
import { cleanText, toId } from "@/lib/oracle";
import { MAX_SWING_NAME_LENGTH, loadSwing } from "@/lib/pendulum";
import { idParam } from "@/lib/own-http";

interface Outcome {
  status: number;
  error?: string;
}

const STAYS_IN_PLAY = "At least one swing has to stay in play.";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const swing = await loadSwing(session.userId, toId(id));
  if (!swing) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(swing);
}

// Changes one swing. Only the fields in the body change:
//   meaning: the person's own words. A changed wording keeps the one it replaces as an earlier wording; an empty
//            one clears the meaning and keeps the earlier wording too.
//   in_play: whether the swing can come up. At least one swing has to stay in play.
//   name:    the name of an added swing. The starting swings keep their names.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.userId;
  const swingId = toId(id);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return Response.json({ error: "Invalid JSON" }, { status: 400 });
  if (body.meaning !== undefined && body.meaning !== null && typeof body.meaning !== "string") {
    return Response.json({ error: "meaning must be text" }, { status: 400 });
  }
  if (body.name !== undefined && body.name !== null && typeof body.name !== "string") {
    return Response.json({ error: "name must be text" }, { status: 400 });
  }

  const outcome = await withTransaction<Outcome>(async (client) => {
    // Lock the person's swings, so two changes at once cannot both leave nothing in play.
    await client.query("SELECT id FROM pendulum_swings WHERE user_id = $1 FOR UPDATE", [userId]);
    const { rows } = await client.query(
      "SELECT id, builtin, meaning, in_play, updated_at FROM pendulum_swings WHERE id = $1 AND user_id = $2",
      [swingId, userId]
    );
    const swing = rows[0];
    if (!swing) return { status: 404, error: "Not found" };

    if (body.name !== undefined && swing.builtin === 1) {
      return { status: 400, error: "A starting swing keeps its name." };
    }
    if (body.in_play !== undefined && !body.in_play && swing.in_play === 1) {
      const { rows: others } = await client.query(
        "SELECT COUNT(*)::int AS c FROM pendulum_swings WHERE user_id = $1 AND in_play = 1 AND id <> $2",
        [userId, swingId]
      );
      if (others[0].c === 0) return { status: 409, error: STAYS_IN_PLAY };
    }

    if (body.meaning !== undefined) {
      const next = cleanText(body.meaning);
      if (next !== swing.meaning) {
        // The wording being replaced is kept, dated when it was written. Emptying the meaning keeps it too.
        if (swing.meaning) {
          await client.query(
            "INSERT INTO pendulum_swing_revisions (user_id, swing_id, content, created_at) VALUES ($1, $2, $3, $4)",
            [userId, swingId, swing.meaning, swing.updated_at]
          );
        }
        await client.query(
          "UPDATE pendulum_swings SET meaning = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3",
          [next, swingId, userId]
        );
      }
    }
    if (body.in_play !== undefined) {
      await client.query("UPDATE pendulum_swings SET in_play = $1 WHERE id = $2 AND user_id = $3", [
        body.in_play ? 1 : 0,
        swingId,
        userId,
      ]);
    }
    if (body.name !== undefined) {
      await client.query("UPDATE pendulum_swings SET name = $1 WHERE id = $2 AND user_id = $3", [
        cleanText(body.name)?.slice(0, MAX_SWING_NAME_LENGTH) ?? null,
        swingId,
        userId,
      ]);
    }
    return { status: 200 };
  });

  if (outcome.status !== 200) return Response.json({ error: outcome.error }, { status: outcome.status });
  return Response.json(await loadSwing(userId, swingId));
}

// Deletes an added swing with its earlier wordings. The five starting swings cannot be deleted; they can be left
// out of play. Answers the swing gave stay, with the swing's name and the wording it had then.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.userId;
  const swingId = toId(id);

  const outcome = await withTransaction<Outcome>(async (client) => {
    await client.query("SELECT id FROM pendulum_swings WHERE user_id = $1 FOR UPDATE", [userId]);
    const { rows } = await client.query(
      "SELECT id, builtin, in_play FROM pendulum_swings WHERE id = $1 AND user_id = $2",
      [swingId, userId]
    );
    const swing = rows[0];
    if (!swing) return { status: 404, error: "Not found" };
    if (swing.builtin === 1) {
      return { status: 400, error: "The five starting swings cannot be deleted. Leave one out of play instead." };
    }
    if (swing.in_play === 1) {
      const { rows: others } = await client.query(
        "SELECT COUNT(*)::int AS c FROM pendulum_swings WHERE user_id = $1 AND in_play = 1 AND id <> $2",
        [userId, swingId]
      );
      if (others[0].c === 0) return { status: 409, error: STAYS_IN_PLAY };
    }
    await client.query("DELETE FROM pendulum_swings WHERE id = $1 AND user_id = $2", [swingId, userId]);
    return { status: 204 };
  });

  if (outcome.status === 204) return new Response(null, { status: 204 });
  return Response.json({ error: outcome.error }, { status: outcome.status });
}
