import { NextRequest } from "next/server";
import { query, queryOne, withTransaction } from "@/lib/db";
import { getSession } from "@/lib/session";
import { tooLong } from "@/lib/limits";
import { DEFAULT_POSITION_COLOR } from "@/lib/position-colors";
import { visibleSql } from "@/lib/forum-reports";
import { journalSnapshot, synthesisSnapshot } from "@/lib/forum-snapshots";
import { forumViewer } from "@/lib/forum-circles";
import { NO_CIRCLE_NOTE, canPost, listScope } from "@/lib/forum-circles-core";
import { toId } from "@/lib/oracle";

export async function GET() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  // Posts reported by enough different people (HIDE_AFTER) are left out, except for their author and the owner (migration 054).
  // The forum belongs to a circle (migration 074): a person gets the posts of their own circle and their own.
  const viewer = await forumViewer(session.userId, !!session.isAdmin);
  const params: unknown[] = [session.userId, !!session.isAdmin];
  const where = [visibleSql("fp", "$1", "$2"), listScope(viewer, "fp", params)];
  const posts = await query(`
    SELECT fp.*, u.username, u.display_name,
      (SELECT COUNT(*) FROM forum_post_attachments WHERE post_id = fp.id) AS attachment_count,
      (SELECT COUNT(*) FROM forum_comments WHERE post_id = fp.id AND hidden_at IS NULL) AS comment_count
    FROM forum_posts fp
    JOIN users u ON u.id = fp.user_id
    WHERE ${where.join(" AND ")}
    ORDER BY fp.created_at DESC
  `, params);
  return Response.json(posts);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // The forum belongs to a circle (migration 074): writing needs one.
  const viewer = await forumViewer(session.userId, !!session.isAdmin);
  if (!canPost(viewer)) return Response.json({ error: NO_CIRCLE_NOTE }, { status: 403 });

  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object") return Response.json({ error: "The post could not be read." }, { status: 400 });
  const { title, body, attachments } = payload;
  if (typeof title !== "string" || !title.trim()) return Response.json({ error: "title is required" }, { status: 400 });
  if (typeof body !== "string" || !body.trim()) return Response.json({ error: "body is required" }, { status: 400 });

  if (tooLong(title, 200) || tooLong(body, 10000)) {
    return Response.json({ error: "That post is too long (title 200 characters, text 10,000)" }, { status: 400 });
  }
  if (Array.isArray(attachments) && attachments.length > 10) {
    return Response.json({ error: "A post can carry at most 10 attachments" }, { status: 400 });
  }

  const validTypes = new Set(["reading", "journal", "synthesis_journal"]);

  if (Array.isArray(attachments) && attachments.length > 0) {
    for (const att of attachments) {
      if (!att || !validTypes.has(att.type)) {
        return Response.json({ error: "Invalid attachment type" }, { status: 400 });
      }
      // A whole number, so a stray value is a plain refusal here and not a database error.
      att.ref_id = toId(att.ref_id);
      if (!att.ref_id) return Response.json({ error: "attachment ref_id is required" }, { status: 400 });

      let owned: any = null;
      if (att.type === "reading") {
        owned = await queryOne("SELECT id FROM readings WHERE id = $1 AND user_id = $2", [att.ref_id, session.userId]);
      } else if (att.type === "journal") {
        owned = await queryOne(
          "SELECT j.id FROM journals j JOIN readings r ON r.id = j.reading_id WHERE j.id = $1 AND r.user_id = $2",
          [att.ref_id, session.userId]
        );
      } else if (att.type === "synthesis_journal") {
        owned = await queryOne("SELECT id FROM synthesis_journals WHERE id = $1 AND user_id = $2", [att.ref_id, session.userId]);
      }
      if (!owned) {
        return Response.json({ error: `Attachment not found or not owned: ${att.type} ${att.ref_id}` }, { status: 403 });
      }
    }
  }

  const snapshots: Record<number, string> = {};
  if (Array.isArray(attachments)) {
    for (let i = 0; i < attachments.length; i++) {
      const att = attachments[i];
      if (att.type === "journal") {
        // Frozen like a reading: later edits or deletion of the entry do not change what is shown. Ownership was checked above.
        const j = await queryOne("SELECT j.* FROM journals j JOIN readings r ON r.id = j.reading_id WHERE j.id = $1 AND r.user_id = $2", [att.ref_id, session.userId]) as any;
        if (!j) continue;
        const ref = await queryOne("SELECT id, title, spread_name FROM readings WHERE id = $1 AND user_id = $2", [j.reading_id, session.userId]) as any;
        snapshots[i] = journalSnapshot(j, ref ?? null);
        continue;
      }
      if (att.type === "synthesis_journal") {
        const sj = await queryOne("SELECT prompt, content, created_at FROM synthesis_journals WHERE id = $1 AND user_id = $2", [att.ref_id, session.userId]) as any;
        if (sj) snapshots[i] = synthesisSnapshot(sj);
        continue;
      }
      if (att.type !== "reading") continue;
      const reading = await queryOne("SELECT * FROM readings WHERE id = $1 AND user_id = $2", [att.ref_id, session.userId]) as any;
      if (!reading) continue;
      const rawCards = JSON.parse(reading.cards) as any[];

      let positionColors: string[] = [];
      if (reading.spread_id) {
        const spread = await queryOne("SELECT positions FROM spreads WHERE id = $1", [reading.spread_id]) as any;
        if (spread) {
          const positions = JSON.parse(spread.positions) as any[];
          positionColors = positions.map((p: any) => p.color ?? DEFAULT_POSITION_COLOR);
        }
        const override = await queryOne(
          "SELECT colors FROM spread_color_overrides WHERE user_id = $1 AND spread_id = $2",
          [session.userId, reading.spread_id]
        ) as any;
        if (override) {
          const overrideColors = JSON.parse(override.colors) as string[];
          overrideColors.forEach((c, idx) => { if (c) positionColors[idx] = c; });
        }
      }

      const coloredCards = rawCards.map((c: any, idx: number) => ({
        position: c.position,
        card_id: c.card_id,
        card_name: c.card_name,
        reversed: c.reversed,
        // A reading made with a layout keeps its own colour and place on each card; older ones take the spread's colour.
        color: c.color ?? positionColors[idx] ?? DEFAULT_POSITION_COLOR,
        ...(typeof c.x === "number" && typeof c.y === "number" ? { x: c.x, y: c.y, rotation: c.rotation ?? 0 } : {}),
      }));

      const clarifiers = reading.clarifiers ? JSON.parse(reading.clarifiers) : {};
      snapshots[i] = JSON.stringify({
        spread_name: reading.spread_name,
        title: reading.title ?? null,
        question: reading.question ?? null,
        cards: coloredCards,
        clarifiers,
      });
    }
  }

  const postId = await withTransaction(async (client) => {
    const { rows: [{ id }] } = await client.query(
      "INSERT INTO forum_posts (user_id, title, body, circle_id) VALUES ($1, $2, $3, $4) RETURNING id",
      [session.userId, title.trim(), body.trim(), viewer.circleId]
    );
    if (Array.isArray(attachments)) {
      for (let i = 0; i < attachments.length; i++) {
        const att = attachments[i];
        await client.query(
          "INSERT INTO forum_post_attachments (post_id, type, ref_id, snapshot) VALUES ($1, $2, $3, $4)",
          [id, att.type, att.ref_id, snapshots[i] ?? null]
        );
      }
    }
    return id;
  });

  return Response.json({ id: postId }, { status: 201 });
}
