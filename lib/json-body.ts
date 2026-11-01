// Pure (no session, no database), so the guard test can call it.
/**
 * The JSON body of a request, or a 400 response to return when the body is not JSON (a JSON object or array). A route reads
 * it as `const sent = await jsonBody(request); if (sent instanceof Response) return sent;`, so a broken body is the sender's
 * error (400), never a server error (500).
 */
export async function jsonBody(request: Request): Promise<any> {
  const body = await request.json().catch(() => undefined);
  if (body === null || typeof body !== "object") return Response.json({ error: "The request body must be JSON." }, { status: 400 });
  return body;
}
