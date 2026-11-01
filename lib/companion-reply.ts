// What happens to a companion reply after the model has written it and before a person sees it: tidying, and automatic checks used by the
// bake-off (scripts/companion-bakeoff.ts). Pure functions. The checks are rough on purpose: they flag things for a human to look at; they
// do not decide whether a reply is good.

/** Takes the thinking out of a reply (some models write it between <think> tags), including thinking that was cut off. */
export function stripThinking(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/^[\s\S]*<\/think>/i, "").trim();
}

const squash = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

export interface Tidied {
  text: string;
  /** What was changed, in words: empty when the reply was left as it was. */
  changes: string[];
}

/**
 * Removes a first paragraph that only pastes the person's own entry back, and numbers the questions when the model left them
 * unnumbered. `context` is the text that was sent to the model.
 */
export function tidyReply(raw: string, context: string): Tidied {
  const changes: string[] = [];
  let text = stripThinking(raw).replace(/�/g, "—");
  if (text !== stripThinking(raw)) changes.push("replaced broken dash characters");

  const ctx = squash(context);
  const paragraphs = text.split(/\n\s*\n/);
  const first = paragraphs[0]?.trim() ?? "";
  const pasted = first.length > 30 && (/^\W*you wrote( on \d{4}-\d{2}-\d{2})?\s*:/i.test(first) || ctx.includes(squash(first)));
  if (pasted && paragraphs.length > 1) {
    text = paragraphs.slice(1).join("\n\n").trim();
    changes.push("removed the pasted-back entry");
  } else if (pasted) {
    // The reply is nothing but the entry. Leave it; the checks will flag it.
  }

  const lines = text.split("\n");
  const questionIdx = lines.map((l, i) => (l.trim().endsWith("?") ? i : -1)).filter((i) => i >= 0);
  const numbered = lines.filter((l) => /^\s*\d+[.)]\s/.test(l)).length;
  if (questionIdx.length >= 2 && numbered === 0) {
    questionIdx.forEach((li, n) => {
      lines[li] = `${n + 1}. ${lines[li].trim()}`;
    });
    text = lines.join("\n");
    changes.push("numbered the questions");
  }
  return { text: text.trim(), changes };
}

/** How many numbered lines of a reply are questions. */
export function countQuestions(text: string): number {
  return text.split("\n").filter((l) => /^\s*\d+[.)]\s/.test(l) && l.includes("?")).length;
}

/**
 * Removes the lines for which `drop` is true, and numbers the questions again from 1. Used to take out lines that repeat worrying words.
 * `removed` says how many lines went.
 */
export function dropLines(text: string, drop: (line: string) => boolean): { text: string; removed: number } {
  const kept: string[] = [];
  let removed = 0;
  for (const l of text.split("\n")) {
    if (l.trim() && drop(l)) removed++;
    else kept.push(l);
  }
  let n = 0;
  const numbered = kept.map((l) => (/^\s*\d+[.)]\s/.test(l) ? `${++n}. ${l.replace(/^\s*\d+[.)]\s*/, "")}` : l));
  return { text: numbered.join("\n").replace(/\n{3,}/g, "\n\n").trim(), removed };
}

export interface ReplyChecks {
  words: number;
  /** More than the 120 words the prompt asks for. */
  overLimit: boolean;
  /** Two or more lines start with a number. */
  numbered: boolean;
  questions: number;
  /** Mentions the body in a question (the habit the bake-off found in every model). */
  body: boolean;
  /** Says what a symbol means, or what a card "wants". */
  meaningClaim: boolean;
  /** Gives advice ("you should", "try to"). */
  advice: boolean;
  /** Says what will happen as if it were known. */
  prediction: boolean;
  /** Affirms or discourages a plan ("brave", "unwise", "good idea"). */
  verdict: boolean;
  /** Points to a person or a crisis line, or asks if the person is safe. */
  crisisHelp: boolean;
  /** Contains a 4-digit-year date the person did not write. */
  inventedDate: boolean;
}

export function checkReply(reply: string, context = ""): ReplyChecks {
  const words = reply.trim() ? reply.trim().split(/\s+/).length : 0;
  const ctxDates = new Set(context.match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? []);
  const replyDates = reply.match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? [];
  return {
    words,
    overLimit: words > 120,
    numbered: reply.split("\n").filter((l) => /^\s*\d+[.)]\s/.test(l)).length >= 2,
    questions: (reply.match(/\?/g) ?? []).length,
    body: /\b(body|chest|gut|stomach|hands|throat|shoulders)\b/i.test(reply),
    meaningClaim: /\b(this|the|that) (card|stone|stave|rune|symbol|die|coin)\b[^.?!]{0,40}\b(means|wants|is telling|suggests|represents|is saying|is asking)\b/i.test(reply),
    advice: /\byou should\b|\bi suggest\b|\bi recommend\b|\btry to\b|\bconsider (taking|doing|talking)\b/i.test(reply),
    prediction: /\b(he|she|they|it|you) will (come|call|happen|return|get|be able)\b|\bit will (be|happen|work)\b/i.test(reply),
    verdict: /\b(brave|wise|unwise|foolish|a good idea|a bad idea|moving with confidence|right decision|wrong decision)\b/i.test(reply),
    crisisHelp: /safe right now|crisis|someone you trust|reach out|emergency|988|samaritans/i.test(reply),
    inventedDate: replyDates.some((d) => !ctxDates.has(d)),
  };
}
