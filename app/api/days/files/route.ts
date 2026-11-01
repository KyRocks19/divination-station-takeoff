import { getSession } from "@/lib/session";
import { collectDayFiles } from "@/lib/days-files";

// Every one of the signed-in person's days as a Markdown file (a name and the text), for their browser to write into a folder they choose, and the
// person's own writing per day so it can compare files it reads back. Only their own days; no path is ever given or taken.
export async function GET() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await collectDayFiles(session.userId));
}
