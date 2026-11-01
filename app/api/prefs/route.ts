import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getPrefs } from "@/lib/prefs";
import { DIVINATION_KINDS } from "@/lib/divinations";
import { MAX_COMPANION_NAME } from "@/lib/prefs-shared";
import { FOCUS_MILESTONES, MAX_FOCUS_LINE, MAX_NOTE, focusOption } from "@/lib/companion-focus";
import { NEEDS_ADULT_MESSAGE, adultConfirmed } from "@/lib/adult";
import { cleanNavFolded } from "@/lib/nav-groups";

export async function GET() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await getPrefs(session.userId));
}

// Unlike the other fields, `tools` is a list of kinds, or null for every tool. Returns an error message, or null.
async function saveTools(userId: number, tools: unknown): Promise<string | null> {
  if (tools === null) {
    await query("UPDATE users SET chosen_tools = NULL WHERE id = $1", [userId]);
    return null;
  }
  if (!Array.isArray(tools) || !tools.every((t) => DIVINATION_KINDS.includes(t))) {
    return "tools must be null or a list of known tools";
  }
  const chosen = DIVINATION_KINDS.filter((k) => tools.includes(k));
  if (chosen.length === 0) return "tools must not be empty; use null for every tool";
  await query("UPDATE users SET chosen_tools = $1 WHERE id = $2", [chosen.join(","), userId]);
  return null;
}

// Only the fields present in the body are changed.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return Response.json({ error: "Invalid JSON" }, { status: 400 });

  if (body.hemisphere !== undefined) {
    if (!["north", "south"].includes(body.hemisphere)) {
      return Response.json({ error: "hemisphere must be 'north' or 'south'" }, { status: 400 });
    }
    await query("UPDATE users SET hemisphere = $1 WHERE id = $2", [body.hemisphere, session.userId]);
  }
  if (body.scaffolding !== undefined) {
    if (!["more", "less"].includes(body.scaffolding)) {
      return Response.json({ error: "scaffolding must be 'more' or 'less'" }, { status: 400 });
    }
    await query("UPDATE users SET scaffolding = $1 WHERE id = $2", [body.scaffolding, session.userId]);
  }
  if (body.lookbackPrompts !== undefined) {
    await query("UPDATE users SET lookback_prompts = $1 WHERE id = $2", [body.lookbackPrompts ? 1 : 0, session.userId]);
  }
  if (body.oraclePrompts !== undefined) {
    await query("UPDATE users SET oracle_prompts = $1 WHERE id = $2", [body.oraclePrompts ? 1 : 0, session.userId]);
  }
  if (body.artHelp !== undefined) {
    await query("UPDATE users SET art_help = $1 WHERE id = $2", [body.artHelp ? 1 : 0, session.userId]);
  }
  if (body.guessFirst !== undefined) {
    await query("UPDATE users SET guess_first = $1 WHERE id = $2", [body.guessFirst ? 1 : 0, session.userId]);
  }
  if (body.companionEnabled !== undefined) {
    if (body.companionEnabled && !(await adultConfirmed(session.userId))) return Response.json({ error: NEEDS_ADULT_MESSAGE, code: "needs_adult" }, { status: 403 });
    await query("UPDATE users SET companion_enabled = $1 WHERE id = $2", [body.companionEnabled ? 1 : 0, session.userId]);
  }
  if (body.companionName !== undefined) {
    const name = typeof body.companionName === "string" ? body.companionName.trim() : "";
    if (name.length > MAX_COMPANION_NAME) return Response.json({ error: `The name can be ${MAX_COMPANION_NAME} characters at most` }, { status: 400 });
    // An empty name goes back to the plain "Companion".
    await query("UPDATE users SET companion_name = $1 WHERE id = $2", [name || null, session.userId]);
  }
  if (body.companionFocus !== undefined) {
    if (body.companionFocus !== null && !focusOption(body.companionFocus)) return Response.json({ error: "That is not one of the focus choices" }, { status: 400 });
    await query("UPDATE users SET companion_focus = $1 WHERE id = $2", [body.companionFocus, session.userId]);
  }
  if (body.companionFocusLine !== undefined) {
    const line = typeof body.companionFocusLine === "string" ? body.companionFocusLine.replace(/\s+/g, " ").trim() : "";
    if (line.length > MAX_FOCUS_LINE) return Response.json({ error: `The line can be ${MAX_FOCUS_LINE} characters at most` }, { status: 400 });
    await query("UPDATE users SET companion_focus_line = $1 WHERE id = $2", [line || null, session.userId]);
  }
  if (body.daysListReadings !== undefined) {
    await query("UPDATE users SET days_list_readings = $1 WHERE id = $2", [body.daysListReadings ? 1 : 0, session.userId]);
  }
  if (body.companionNote !== undefined) {
    const note = typeof body.companionNote === "string" ? body.companionNote.replace(/\s+/g, " ").trim() : "";
    if (note.length > MAX_NOTE) return Response.json({ error: `The note can be ${MAX_NOTE} characters at most` }, { status: 400 });
    await query("UPDATE users SET companion_note = $1 WHERE id = $2", [note || null, session.userId]);
  }
  if (body.companionFocusAsked !== undefined) {
    // Only a milestone (or 0 to be asked again) can be stored.
    const n = Number(body.companionFocusAsked);
    if (n !== 0 && !FOCUS_MILESTONES.includes(n)) return Response.json({ error: "That is not a milestone" }, { status: 400 });
    await query("UPDATE users SET companion_focus_asked = $1 WHERE id = $2", [n, session.userId]);
  }
  if (body.navFolded !== undefined) {
    const folded = cleanNavFolded(body.navFolded);
    if (!folded) return Response.json({ error: "navFolded must be a list of parts of the menu" }, { status: 400 });
    await query("UPDATE users SET nav_folded = $1 WHERE id = $2", [folded.join(","), session.userId]);
  }
  if (body.tools !== undefined) {
    const problem = await saveTools(session.userId, body.tools);
    if (problem) return Response.json({ error: problem }, { status: 400 });
  }

  return Response.json(await getPrefs(session.userId));
}
