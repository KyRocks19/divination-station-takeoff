// The shapes the companion's pages share with its queue. No database code here, so client components can import it.

import type { CompanionMode } from "./companion-modes";

export type JobStatus = "queued" | "running" | "done" | "failed" | "cancelled";

export interface JobView {
  id: number;
  mode: CompanionMode;
  status: JobStatus;
  action: "questions" | "reply" | "crisis" | "checkin" | "gentle" | null;
  /** What the person is shown, once the request is answered. */
  result: string | null;
  error: string | null;
  /** How many requests are waiting or being answered ahead of this one. */
  ahead: number;
  created_at: string;
  /** For a question about a pattern: which one ("runes:rune-fehu"). */
  pattern_ref?: string | null;
}

export interface NoteView {
  id: number;
  mode: CompanionMode;
  companion_name: string;
  content: string;
  created_at: string;
}
