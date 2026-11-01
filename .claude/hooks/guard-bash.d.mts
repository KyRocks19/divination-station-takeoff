/** What the guard hook decides about a shell command: no objection (null), or a question or a refusal with the reason. */
export function decide(
  command: unknown,
  mode: "push" | "live" | "heredoc" | string,
  hosts?: { dev: string; live: string },
): { decision: "ask" | "deny"; reason: string } | null;

/** The dev and live databases' endpoint names, read from .env.development.local and .env.local ("" when missing). */
export function hostsFromEnvFiles(dir?: string): { dev: string; live: string };

/** Whether a shell command holds a heredoc (<<EOF) outside quotes; here-strings and arithmetic are not heredocs. */
export function hasHeredoc(command: string): boolean;
