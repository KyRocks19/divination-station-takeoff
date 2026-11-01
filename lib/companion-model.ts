import { companionModel } from "./companion-config";
import { stripThinking } from "./companion-reply";
import type { AskModel } from "./companion-run";
import { FEATHERED } from "./edition";

// Talking to the model on the owner's computer: KoboldCpp in router mode (see docs/companion.md). Server and studio code only.

export interface ModelEndpoint {
  /** KoboldCpp's address, for example http://localhost:5002. */
  url: string;
  /** The admin password KoboldCpp was started with, when it has one. */
  password?: string;
  /** The config file in KoboldCpp's admin folder to answer with. */
  model: string;
}

/** The model's address from the environment, or null when this copy cannot reach one. */
export function companionEndpoint(env: Record<string, string | undefined> = process.env, feathered = FEATHERED): ModelEndpoint | null {
  // The Feathered edition has no companion and makes no connection (docs/plan-feathered-edition.md).
  if (feathered) return null;
  const url = env.COMPANION_URL?.trim().replace(/\/+$/, "");
  if (!url || !/^https?:\/\//i.test(url)) return null;
  return { url, password: env.COMPANION_PASSWORD?.trim() || undefined, model: companionModel(env) };
}

/** "direct" when this server can reach the model itself (the owner's own computer); "queue" when a studio must fetch the work. */
export function companionMode(env: Record<string, string | undefined> = process.env): "direct" | "queue" {
  return companionEndpoint(env) ? "direct" : "queue";
}

/** The request body for one chat call. Thinking is switched off: a thinking model can use its whole budget before it answers. */
export function chatBody(model: string, messages: { role: string; content: string }[], maxTokens: number, temperature: number) {
  return {
    model,
    messages,
    max_tokens: maxTokens,
    temperature,
    chat_template_kwargs: { enable_thinking: false },
    reasoning_effort: "none",
  };
}

/** A function that asks the model, for the companion's orchestration (lib/companion-run.ts). Throws when the model cannot answer. */
export function makeAsk(ep: ModelEndpoint, fetchImpl: typeof fetch = fetch): AskModel {
  return async (messages, opts) => {
    const res = await fetchImpl(`${ep.url}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(ep.password ? { Authorization: `Bearer ${ep.password}` } : {}) },
      body: JSON.stringify(chatBody(ep.model, messages, opts.maxTokens, opts.temperature)),
      // The first request after the model was swapped out includes loading it from disk.
      signal: AbortSignal.timeout(180_000),
    });
    if (!res.ok) throw new Error(`the model answered HTTP ${res.status}`);
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return stripThinking(json.choices?.[0]?.message?.content ?? "");
  };
}
