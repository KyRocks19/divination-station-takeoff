import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { getPrefs } from "@/lib/prefs";
import { cleanTheme, saveTheme } from "@/lib/theme";

// The person's own colours, or null for the app's own.
export async function GET() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const prefs = await getPrefs(session.userId);
  return Response.json({ theme: prefs.theme });
}

// Saves the person's colours. The body is { theme: { "color-blush": "#fdccf5", ... } } or { theme: null }, which puts the
// app's own colours back. Only the lab's tokens with six-digit hex colours are kept.
export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || !("theme" in body)) {
    return Response.json({ error: "theme is required (an object of colours, or null)" }, { status: 400 });
  }
  const theme = body.theme === null ? null : cleanTheme(body.theme);
  await saveTheme(session.userId, theme);
  const prefs = await getPrefs(session.userId);
  return Response.json({ theme: prefs.theme });
}
