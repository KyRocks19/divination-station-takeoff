import { getSession } from "@/lib/session";
import { loadFacts } from "@/lib/companion-noticed";
import { factLines, factsContext } from "@/lib/companion-facts";

// The counts the app makes about how the signed-in person uses it (no model, none of their words), as plain lines, and the exact text that would be
// handed to the companion if they ask it to suggest a line for their note. Only reads; works whether or not the companion is switched on.
export async function GET() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const facts = await loadFacts(session.userId);
  return Response.json({ lines: factLines(facts), context: factsContext(facts) });
}
