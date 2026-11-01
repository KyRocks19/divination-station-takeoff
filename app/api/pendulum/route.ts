import { NextRequest } from "next/server";
import { query, queryOne, withTransaction } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getPrefs } from "@/lib/prefs";
import { createRng } from "@/lib/rng";
import { skyAt } from "@/lib/sky";
import { insertDivination } from "@/lib/divinations";
import { cleanText } from "@/lib/oracle";
import { SWING_ANGLE_SQL, SWING_ORDER, cleanAngle, ensureSwings, listAnswers, loadAnswer, splitAngle, swingName } from "@/lib/pendulum";
import { nearestSwing, type MotionReading } from "@/lib/pendulum-motion";

const SHAPES = ["line", "circle_cw", "circle_ccw", "still"] as const;

/** The movement the person's phone made, as the browser summed it up; null when the body has none or it makes no sense. */
function motionOf(body: unknown): MotionReading | null {
  const m = (body as { motion?: { shape?: unknown; angle?: unknown } } | null)?.motion;
  if (!m || typeof m.shape !== "string" || !(SHAPES as readonly string[]).includes(m.shape)) return null;
  const shape = m.shape as MotionReading["shape"];
  if (shape !== "line") return { shape, angle: null };
  const angle = cleanAngle(m.angle);
  return angle === null ? null : { shape, angle };
}

// The person's answers, newest first.
export async function GET() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await listAnswers(session.userId));
}

// Asks the pendulum. By default the app picks one of the swings the person has in play, with equal chance for each,
// using the random method they chose in Settings. When the body carries `motion` (the shape their phone's movement
// made, worked out in the browser), the app instead picks the swing in play that matches it, and the answer says so.
// Either way the answer is saved at once: the question, the sky, the swing, and the person's own words for that swing
// as they are now.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.userId;

  const body = await request.json().catch(() => null);
  const sentMotion = typeof body === "object" && body !== null && "motion" in body;
  const motion = sentMotion ? motionOf(body) : null;
  if (sentMotion && !motion) {
    return Response.json({ error: "The movement was not understood. Nothing was saved." }, { status: 400 });
  }

  await ensureSwings(userId);
  const inPlay = await query<{
    id: number;
    shape: string;
    angle: number | null;
    name: string | null;
    builtin: number;
    meaning: string | null;
  }>(
    `SELECT id, shape, ${SWING_ANGLE_SQL} AS angle, name, builtin, meaning
     FROM pendulum_swings
     WHERE user_id = $1 AND in_play = 1
     ${SWING_ORDER}`,
    [userId]
  );
  if (inPlay.length === 0) {
    return Response.json({ error: "No swing is in play. Put at least one swing in play first." }, { status: 409 });
  }

  const [user, prefs] = await Promise.all([
    queryOne<{ rng_method: string | null }>("SELECT rng_method FROM users WHERE id = $1", [userId]),
    getPrefs(userId),
  ]);
  let swing: (typeof inPlay)[number];
  if (motion) {
    const matched = nearestSwing(inPlay, motion);
    if (!matched) {
      return Response.json(
        { error: "None of the swings you have in play goes that way. Put one in play, or let chance pick. Nothing was saved." },
        { status: 409 }
      );
    }
    swing = matched;
  } else {
    const rng = await createRng(user?.rng_method ?? "math");
    swing = inPlay[Math.min(inPlay.length - 1, Math.floor(rng() * inPlay.length))];
  }
  const name = swingName(swing);
  const { whole, tenths } = swing.angle === null ? { whole: null, tenths: 0 } : splitAngle(swing.angle);

  // Snapshot of the sky at the moment of the answer, in the person's own time zone when the browser sent one.
  const sky = skyAt(new Date(), { tz: typeof body?.tz === "string" ? body.tz : null, hemisphere: prefs.hemisphere });

  const id = await withTransaction(async (client) => {
    const divinationId = await insertDivination(client, {
      userId,
      kind: "pendulum",
      question: cleanText(body?.question),
      summary: name,
      sky: JSON.stringify(sky),
    });
    await client.query(
      `INSERT INTO pendulum_answers (divination_id, user_id, swing_id, shape, angle, angle_tenths, swing_name, meaning, chosen_by, motion_shape, motion_angle)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        divinationId, userId, swing.id, swing.shape, whole, tenths, name, swing.meaning,
        motion ? "motion" : "chance",
        motion?.shape ?? null,
        motion?.angle === null || motion?.angle === undefined ? null : Math.round(motion.angle) % 180,
      ]
    );
    return divinationId;
  });

  return Response.json(await loadAnswer(userId, id), { status: 201 });
}
