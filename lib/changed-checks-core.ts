// Which project checks apply to a set of changed files. Pure: the same table that
// .claude/skills/pre-commit-check/SKILL.md section 1 describes, so a session does not
// have to work it out (or load every check skill) by reading.

export type CheckRule = {
  check: string;
  why: string;
  matches: (path: string, isClientFile: boolean) => boolean;
};

const startsWith = (...prefixes: string[]) => (p: string) => prefixes.some((x) => p.startsWith(x));

export const CHECK_RULES: CheckRule[] = [
  {
    check: "data-lifecycle-check",
    why: "migration or stored text",
    matches: startsWith("migrations/"),
  },
  {
    check: "design-system-check + accessibility-pass",
    why: "components or pages changed",
    matches: (p) =>
      p.startsWith("components/") || /^app\/.*page\.tsx$/.test(p) || p === "app/globals.css",
  },
  {
    check: "client-safety-check",
    why: "a browser-side file changed",
    matches: (_p, isClientFile) => isClientFile,
  },
  {
    check: "companion-privacy-audit",
    why: "the companion or what it can read",
    matches: (p) =>
      /^lib\/companion-/.test(p) ||
      /^app\/api\/.*companion/.test(p) ||
      /^lib\/patterns/.test(p) ||
      p === "lib/reading-context.ts",
  },
  {
    check: "write-ritual-source",
    why: "meanings or sources",
    matches: (p) =>
      /^lib\/.*-data\.ts$/.test(p) ||
      p === "lib/sources.ts" ||
      (p.startsWith("data/") && /archetypes/.test(p)),
  },
  {
    check: "new-api-route + next16-docs",
    why: "routes or framework config",
    matches: (p) => p.startsWith("app/api/") || p === "proxy.ts" || p === "next.config.ts",
  },
  {
    check: "copy-check",
    why: "words a person reads may have changed",
    matches: (p) =>
      p.startsWith("components/") ||
      /^app\/.*page\.tsx$/.test(p) ||
      p === "lib/tour-steps.ts" ||
      /^lib\/(privacy|companion-safety|nav-groups)/.test(p),
  },
  {
    check: "open-item-sync quick",
    why: "the open-work documents changed",
    matches: (p) => p === "docs/open-items.md" || p.startsWith(".claude/skills/oracle-feature-design/"),
  },
];

export function applicableChecks(
  changed: string[],
  clientFiles: ReadonlySet<string> = new Set(),
): { check: string; why: string; files: string[] }[] {
  const out: { check: string; why: string; files: string[] }[] = [];
  for (const rule of CHECK_RULES) {
    const files = changed.filter((p) => rule.matches(p, clientFiles.has(p)));
    if (files.length) out.push({ check: rule.check, why: rule.why, files });
  }
  return out;
}

const SECRET_PATTERNS: [string, RegExp][] = [
  ["Anthropic key", /sk-ant-[A-Za-z0-9_-]{10,}/],
  ["database address with a password", /postgres(?:ql)?:\/\/[^\s:@/]+:[^\s@/<>$]+@/],
  ["session secret", /SESSION_SECRET\s*=\s*(?![<$])\S{8,}/],
  ["Claude key setting", /CLAUDE_API_KEY\s*=\s*(?![<$])\S{8,}/],
  ["worker token setting", /WORKER_TOKEN\s*=\s*(?![<$])\S{8,}/],
  ["circle key secret setting", /CIRCLE_KEY_SECRET\s*=\s*(?![<$])\S{8,}/],
  ["admin password setting", /(ADMIN_INITIAL_PASSWORD|KCPP_ADMINPASSWORD)\s*=\s*(?![<$])\S{6,}/],
  ["Redis address with a password", /rediss?:\/\/[^\s:@/]*:[^\s@/<>$]+@/],
  ["Upstash token setting", /UPSTASH_[A-Z_]*TOKEN\s*=\s*(?![<$])\S{8,}/],
  ["GitHub token", /\b(ghp|gho|ghs|ghu|github_pat)_[A-Za-z0-9_]{20,}/],
  ["private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["Tailscale auth key", /\btskey-[A-Za-z0-9-]{10,}/],
];

// Things that are not secrets but are the owner's rather than the project's, and
// should not be in a public copy (docs/public-release-planning.md, section 7).
const PERSONAL_PATTERNS: [string, RegExp][] = [
  ["tailnet hostname", /\b[a-z0-9-]+\.[a-z0-9-]+\.ts\.net\b/i],
  ["Neon host name", /\bep-[a-z]+-[a-z]+-[a-z0-9]+(?:-pooler)?\.[a-z0-9.-]*neon\.tech\b/i],
  ["Windows user folder", /C:[\\/]+Users[\\/]+(?!<|Public\b|Default\b)[A-Za-z0-9._-]+/i],
];

// Values that are made-up examples in docs and tests, checked by hand on 2026-10-22.
// A line that matches one of these is not reported as a secret.
const PLACEHOLDERS =
  /not-a-secret|spike-secret|paste-the-token|dsw_\.\.\.|user:password@host|\/\/u:p@|:throwaway@|user:secret@ep-example|sk-ant-api03-abcd(ef|WXYZ)/;
// Made-up host names used as examples.
const EXAMPLE_HOSTS = /\b(my-pc|example|other)\.|tail1234|ep-x\.|ep-example/i;

export type HistoryFinding = { kind: "secret" | "personal"; label: string; commit: string; path: string };

/**
 * Scans the output of `git log -p --unified=0 --format=commit:%H` for secrets and
 * personal material in added lines. A finding names the commit and the file, never
 * the value, so the report itself can be pasted anywhere.
 */
export function scanHistoryPatch(patch: string): HistoryFinding[] {
  const found = new Map<string, HistoryFinding>();
  let commit = "";
  let path = "";
  const add = (f: HistoryFinding) => found.set(`${f.kind}|${f.label}|${f.commit}|${f.path}`, f);
  for (const line of patch.split("\n")) {
    if (line.startsWith("commit:")) {
      commit = line.slice(7).trim();
      continue;
    }
    if (line.startsWith("+++ ")) {
      path = line.startsWith("+++ b/") ? line.slice(6) : line.slice(4);
      if (path !== "/dev/null" && RISKY_NAMES.test(path) && !/\.env\.example$/.test(path)) {
        add({ kind: "secret", label: "risky file name", commit, path });
      }
      continue;
    }
    if (!line.startsWith("+")) continue;
    const text = line.slice(1);
    if (!PLACEHOLDERS.test(text)) {
      for (const [label, pattern] of SECRET_PATTERNS) {
        if (pattern.test(text)) add({ kind: "secret", label, commit, path });
      }
    }
    for (const [label, pattern] of PERSONAL_PATTERNS) {
      const m = text.match(pattern);
      if (m && !EXAMPLE_HOSTS.test(m[0])) add({ kind: "personal", label, commit, path });
    }
  }
  return [...found.values()];
}

const RISKY_NAMES = /(^|\/)(\.env(\..*)?|.*\.swp|tarot\.db)$/;

export function scanForSecrets(addedLines: string[], paths: string[]): string[] {
  const found: string[] = [];
  for (const p of paths) {
    if (RISKY_NAMES.test(p) && !/\.env\.example$/.test(p)) found.push(`risky file name: ${p}`);
  }
  for (const line of addedLines) {
    if (PLACEHOLDERS.test(line)) continue;
    for (const [label, pattern] of SECRET_PATTERNS) {
      if (pattern.test(line)) found.push(`${label}: ${line.slice(0, 60)}…`);
    }
  }
  return found;
}
