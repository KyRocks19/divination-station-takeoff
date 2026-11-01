import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { getPrefs } from "@/lib/prefs";
import { parseComfort } from "@/lib/comfort";
import { saveComfort } from "@/lib/comfort-account";

// The person's reading-comfort choices (font, text size, spacing, motion) kept in their account, so they follow them to other devices.
// The device keeps its own copy too (the sign-in page needs it before anyone is signed in).

export async function GET() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const prefs = await getPrefs(session.userId);
  return Response.json({ comfort: prefs.comfort });
}

// Saves { comfort: { font, size, spacing, motion } }. Unknown values fall back to the standard one by one (parseComfort).
export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body.comfort !== "object" || body.comfort === null) {
    return Response.json({ error: "comfort is required (an object of choices)" }, { status: 400 });
  }
  const comfort = parseComfort(JSON.stringify(body.comfort));
  await saveComfort(session.userId, comfort);
  return Response.json({ comfort });
}

// Stops keeping the choices in the account: the device's own choices apply again.
export async function DELETE() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  await saveComfort(session.userId, null);
  return Response.json({ comfort: null });
}
