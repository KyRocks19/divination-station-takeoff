import { getSession } from "@/lib/session";
import { zipOfDays } from "@/lib/days-files";

// The signed-in person's days as a zip of Markdown files, for browsers and phones that cannot save into a folder. Only their own days.
export async function GET() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const made = await zipOfDays(session.userId);
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(Buffer.from(made.bytes), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="divination-station-days-${stamp}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
