import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { cleanText, toId } from "@/lib/oracle";
import { loadChart } from "@/lib/geomancy";
import { deleteReadingOf, setQuestionOf } from "@/lib/tool-reading";
import { idParam } from "@/lib/own-http";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const chart = await loadChart(session.userId, toId(id));
  if (!chart) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(chart);
}

// Changes the question written with a chart. An empty question clears it. The figures that came up cannot be changed.
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!(await setQuestionOf(session.userId, toId(id), "geomancy", cleanText(body?.question)))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json(await loadChart(session.userId, toId(id)));
}

// Deletes the chart: its shared record and, with it, its figures and what was written about it. The person's own meanings for the figures are not touched.
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await deleteReadingOf(session.userId, toId(id), "geomancy"))) return Response.json({ error: "Not found" }, { status: 404 });
  return new Response(null, { status: 204 });
}
