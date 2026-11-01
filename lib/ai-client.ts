// For pages: the plain sentence a failed request came with (for example "You have used your 15 Claude requests for today"),
// or `fallback` when the answer carried none.
export async function errorText(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.error === "string" && body.error.trim()) return body.error;
  } catch {
    /* the answer was not JSON */
  }
  return fallback;
}
