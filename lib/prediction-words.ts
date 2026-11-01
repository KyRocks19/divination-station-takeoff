// The words and shapes of prediction check-ins that the browser needs. No database code here, so client components can import it.

export const OUTCOMES = ["yes", "partly", "no", "unclear"] as const;
export type Outcome = (typeof OUTCOMES)[number];

export const OUTCOME_LABELS: Record<Outcome, string> = {
  yes: "It came true",
  partly: "Partly",
  no: "It did not",
  unclear: "Can't tell, or it never came up",
};

export interface Prediction {
  id: number;
  divination_id: number;
  original_text: string;
  text: string;
  created_at: string;
  /** YYYY-MM-DD, or null for "no date". */
  check_on: string | null;
  outcome: Outcome | null;
  outcome_note: string | null;
  resolved_at: string | null;
}

