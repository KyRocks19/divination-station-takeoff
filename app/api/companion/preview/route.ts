import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { getPrefs } from "@/lib/prefs";
import { toId } from "@/lib/oracle";
import { buildContextFor, type Subject } from "@/lib/companion-subject";
import { isCompanionMode } from "@/lib/companion-modes";
import { focusInstructions } from "@/lib/companion-focus";

// Exactly the text that would be sent to the companion for one reading (divination_id) or one oracle item (card_id), for a mode (default
// "questions"; "changes" adds the person's earlier wordings). Nothing is sent anywhere by this route, and it does nothing at all while the
// person has the companion switched off.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await getPrefs(session.userId)).companionEnabled) {
    return Response.json({ error: "The companion is switched off. Turn it on in Settings." }, { status: 403 });
  }
  const p = request.nextUrl.searchParams;
  const patternParam = p.get("pattern");
  const mode = patternParam !== null ? "pattern" : p.get("mode") ?? "questions";
  if (!isCompanionMode(mode)) return Response.json({ error: "mode must be questions, changes, reading, scene, or pattern" }, { status: 400 });
  const divinationId = toId(p.get("divination_id"));
  const cardId = toId(p.get("card_id"));
  if (patternParam === null && !divinationId === !cardId) return Response.json({ error: "Not found" }, { status: 404 });
  const subject: Subject = patternParam !== null ? { pattern: patternParam } : cardId ? { cardId } : { divinationId };
  const context = await buildContextFor(session.userId, subject, mode);
  if (!context) return Response.json({ error: "Not found" }, { status: 404 });
  // The focus the person set is sent too, with every request that asks the model. "What has changed" is built in code and sends nothing.
  const prefs = await getPrefs(session.userId);
  const focus = mode === "changes" ? "" : focusInstructions(prefs.companionFocus, prefs.companionFocusLine, prefs.companionNote);
  return Response.json({ text: context.text, truncated: context.truncated, characters: context.text.length, focus: focus || null });
}
