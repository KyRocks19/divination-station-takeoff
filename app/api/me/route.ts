import { getSession } from "@/lib/session";
import { editionOf, isHostMode } from "@/lib/edition";

export async function GET() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({
    userId: session.userId,
    username: session.username,
    isAdmin: session.isAdmin ?? false,
    edition: editionOf(),
    host: isHostMode(),
  });
}
