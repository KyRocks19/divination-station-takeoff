import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { logAdminAction } from "@/lib/admin-log";
import { BUNDLE_LIMITS, bundleFileName, checkBundle } from "@/lib/forum-bundle-core";
import { bundleNotReady, circleOf, exportForum, importForum } from "@/lib/forum-bundle";

// Moving a circle's forum between hosts (open item: hosts do not sync). GET saves the signed-in administrator's circle's forum as a .json file.
// POST { data: <that file>, apply: boolean } brings a file from another host into the same person's circle: apply false checks and reports and
// writes nothing, apply true adds what is new in one transaction. It only adds; nothing here is changed or deleted. Rules: lib/forum-bundle-core.ts.
const NOT_READY = "This copy needs to start once more to finish its update before the forum can be moved. Close it, open it again and retry.";
const running = new Set<number>();

export async function GET() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.isAdmin) return Response.json({ error: "Forbidden" }, { status: 403 });
  try {
    const circle = await circleOf(session.userId);
    if (!circle) return Response.json({ error: "You are not in a circle, so there is no forum to save." }, { status: 404 });
    const bundle = await exportForum(circle);
    return new Response(JSON.stringify(bundle, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${bundleFileName(circle.name, new Date())}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (bundleNotReady(err)) return Response.json({ error: NOT_READY }, { status: 503 });
    throw err;
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.isAdmin) return Response.json({ error: "Forbidden" }, { status: 403 });
  const userId = session.userId;

  const length = Number(request.headers.get("content-length"));
  if (Number.isFinite(length) && length > BUNDLE_LIMITS.bytes) {
    return Response.json({ error: "The file is too large to bring in at once." }, { status: 413 });
  }
  const body = (await request.json().catch(() => null)) as { data?: unknown; apply?: unknown } | null;
  const checked = checkBundle(body?.data);
  if (!checked.ok) return Response.json({ error: checked.error }, { status: 400 });

  if (running.has(userId)) return Response.json({ error: "A forum file is already being brought in. Wait for it to finish." }, { status: 409 });
  running.add(userId);
  try {
    const circle = await circleOf(userId);
    if (!circle) return Response.json({ error: "You are not in a circle, so there is nowhere to bring the forum in." }, { status: 404 });
    const apply = body?.apply === true;
    const plan = await importForum(circle.id, userId, checked.bundle, checked.leftOut, apply);
    if (apply && (plan.counts.posts_add > 0 || plan.counts.comments_add > 0)) {
      await logAdminAction(session, "forum_bundle_imported", { detail: `${plan.counts.posts_add} posts, ${plan.counts.comments_add} comments` });
    }
    return Response.json({ applied: apply, circle_name: circle.name, from_circle: checked.bundle.circle_name, attachments_left_out: checked.bundle.posts_with_attachments_left_out, counts: plan.counts });
  } catch (err) {
    if (bundleNotReady(err)) return Response.json({ error: NOT_READY }, { status: 503 });
    throw err;
  } finally {
    running.delete(userId);
  }
}
