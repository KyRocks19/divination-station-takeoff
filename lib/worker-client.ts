import type { CompanionJob, CompanionStep, PictureJob } from "./worker-protocol";

// The picture studio's side of the worker API (app/api/worker/**): plain fetch calls with the studio's token. No database code, so the studio
// needs only the website's address (APP_URL) and its token (WORKER_TOKEN). Every call throws a WorkerApiError on a refusal or a network failure.

export class WorkerApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export interface Hello {
  name: string;
  pictures: boolean;
  companion: boolean;
  requeued: { pictures: number; companion: number };
  /** True when this token belongs to a circle (it takes only that circle's pictures, and has no doorbell). */
  circle?: boolean;
}

/** What the website says to a test call: who the token is and what it may do. Nothing is changed by asking. */
export type Checked = Omit<Hello, "requeued">;

export interface WorkerApi {
  /** For the studio's `--check`: is the token accepted, and what may it do. Changes nothing on the website. */
  check(): Promise<Checked>;
  hello(pollSeconds: number): Promise<Hello>;
  heartbeat(pollSeconds: number, asleep?: boolean): Promise<void>;
  claimPicture(): Promise<PictureJob | null>;
  sendPicture(id: number, bytes: Buffer, mime: string): Promise<boolean>;
  failPicture(id: number, status: number): Promise<void>;
  claimCompanion(model: string): Promise<({ job: CompanionJob } & CompanionStep) | null>;
  stepCompanion(id: number, answers: string[] | "failed", model: string): Promise<CompanionStep>;
}

/** The calls, against `appUrl` (from cleanAppUrl in lib/worker-protocol.ts) with `token`. `fetchImpl` is for tests. */
export function workerApi(appUrl: string, token: string, fetchImpl: typeof fetch = fetch): WorkerApi {
  async function call<T>(path: string, body: unknown, opts: { raw?: { bytes: Buffer; mime: string }; timeoutMs?: number } = {}): Promise<T> {
    let res: Response;
    try {
      res = await fetchImpl(`${appUrl}/api/worker/${path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": opts.raw ? opts.raw.mime : "application/json" },
        body: opts.raw ? new Uint8Array(opts.raw.bytes) : JSON.stringify(body ?? {}),
        signal: AbortSignal.timeout(opts.timeoutMs ?? 60_000),
      });
    } catch (err) {
      throw new WorkerApiError(`could not reach the website (${err instanceof Error ? err.message : err})`, 0);
    }
    const json = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
    if (!res.ok) throw new WorkerApiError(json?.error ?? `the website answered HTTP ${res.status}`, res.status);
    if (json === null) throw new WorkerApiError("the website sent an answer that is not JSON", res.status);
    return json;
  }

  return {
    check: () => call<Checked>("check", {}, { timeoutMs: 20_000 }),
    hello: (pollSeconds) => call<Hello>("hello", { pollSeconds }),
    heartbeat: async (pollSeconds, asleep = false) => {
      await call("heartbeat", { pollSeconds, asleep }, { timeoutMs: asleep ? 3000 : 60_000 });
    },
    claimPicture: async () => (await call<{ job: PictureJob | null }>("pictures/claim", {})).job,
    sendPicture: async (id, bytes, mime) => (await call<{ kept: boolean }>(`pictures/${id}/done`, null, { raw: { bytes, mime } })).kept,
    failPicture: async (id, status) => {
      await call(`pictures/${id}/failed`, { status });
    },
    claimCompanion: async (model) => {
      const r = await call<{ job: CompanionJob | null } & Partial<CompanionStep>>("companion/claim", { model });
      return r.job ? (r as { job: CompanionJob } & CompanionStep) : null;
    },
    // The website runs the companion's checks again on each step, which can take a few seconds with a long history.
    stepCompanion: (id, answers, model) =>
      call<CompanionStep>(`companion/${id}/step`, answers === "failed" ? { failed: true, model } : { answers, model }, { timeoutMs: 120_000 }),
  };
}
