import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { getOghamSettings, saveOghamSettings } from "@/lib/ogham";

export async function GET() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await getOghamSettings(session.userId));
}

// Only the fields present in the body are changed.
export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const current = await getOghamSettings(session.userId);
  const next = {
    forfeda: body?.forfeda === undefined ? current.forfeda : body.forfeda === true,
    laterNames: body?.laterNames === undefined ? current.laterNames : body.laterNames === true,
  };
  await saveOghamSettings(session.userId, next);
  // Read back, so a choice that could not be kept yet (before migration 102) is not reported as saved.
  return Response.json(await getOghamSettings(session.userId));
}
