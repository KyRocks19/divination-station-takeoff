// Guard hooks for shell commands (settings: .claude/settings.json, event PreToolUse, tools Bash and PowerShell).
//
//   node guard-bash.mjs push   refuses any `git push` (you push from your own terminal)
//   node guard-bash.mjs live   blocks migrations, restores and seeds that would write to the LIVE database
//   node guard-bash.mjs heredoc  refuses a heredoc (<<EOF) in the Bash tool; it fails unpredictably on this machine (before-you-code, section 1)
//
// Claude Code gives the hook the tool call as JSON on stdin. The hook answers with JSON on stdout:
// permissionDecision "ask" shows you a prompt, "deny" refuses the command and tells Claude why. No answer means no objection.
// A hook that cannot read its input says nothing, so a mistake here never blocks ordinary work.
//
// The pure function `decide` has no side effects and is tested in tests/guard-bash.test.ts.
//
// THE PUSH GUARD IS A QUESTION (the user's decision of 2026-10-22): PUSH_DECISION below is "ask", and the two `git push` lines in
// .claude/settings.json are under "ask" (a permission rule, so the question appears whatever the permission mode). TO MAKE IT A HARD
// BLOCK AGAIN: change PUSH_DECISION to "deny" and move the two `git push` lines in .claude/settings.json from "ask" to "deny".

import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** What the push guard does: "deny" refuses the command, "ask" shows you a prompt. */
const PUSH_DECISION = "ask";

/** Statements of a command line, split on ; & | and newlines. A guess is fine here: a wrong split can only ask once too often. */
function statements(command) {
  return command
    .split(/\r?\n|;|&&|\|\||\||&/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// `git push`, also `git -C path push`, `git --no-pager push`, env prefixes, and after then/do/else/(/{/!.
const PUSH = /^(?:(?:then|do|else|elif|if|while|\(|\{|!)\s+)*(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)*(?:command\s+|exec\s+)?git\s+(?:-\S+\s+(?:\S+\s+)?)*push(?:\s|$)/;

// The scripts that change a database, and the npm names for them. Reading scripts (backup, tests, the dev server) are not here.
// Only a statement that STARTS with one of these counts, so words in a commit message, an echo or a grep are left alone.
const WRITES_DB = /^(?:npx\s+)?(?:npm\s+run\s+(?:migrate|restore)(?![\w-])|(?:tsx|node)\s+(?:--?\S+\s+)*\S*scripts[\\/](?:migrate|restore-db|seed-[\w-]+|move-art-to-disk|import-sqlite)\.\w+)/i;

/** A statement without what can stand before the command itself: then/do/(, VAR=value, and a case pattern like `ep-your-dev-branch*) `. */
function bareCommand(statement) {
  let s = statement;
  for (let i = 0; i < 8; i++) {
    const before = s;
    s = s.replace(/^(?:then|do|else|elif|if|while|\(|\{|!)\s+/, "");
    s = s.replace(/^[A-Za-z_][A-Za-z0-9_]*=\S*\s+/, "");
    s = s.replace(/^case\s.*?\)\s+/, "");
    s = s.replace(/^\S*\*?\)\s+/, "");
    if (s === before) break;
  }
  return s;
}

/**
 * Whether a shell command holds a heredoc: `<<EOF`, `<<'EOF'`, `<<"EOF"`, `<<-EOF`, `<<\EOF`, outside any quotes. A here-string (`<<<`) and
 * arithmetic such as `$((1<<3))` are not heredocs, and the same characters inside a quoted string (a commit message) are only text.
 */
export function hasHeredoc(command) {
  let quote = null;
  for (let i = 0; i < command.length; i++) {
    const c = command[i];
    if (quote) {
      if (c === "\\" && quote === '"') i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === "\\") {
      i++;
      continue;
    }
    if (c === "'" || c === '"') {
      quote = c;
      continue;
    }
    if (c === "<" && command[i + 1] === "<" && command[i - 1] !== "<" && command[i + 2] !== "<") {
      if (/^-?[ \t]*['"\\]?[A-Za-z_]/.test(command.slice(i + 2))) return true;
    }
  }
  return false;
}

/** The endpoint name of the database in an env file (the first part of DATABASE_URL's host, without "-pooler"), or "". */
function endpointIn(file) {
  try {
    const line = readFileSync(file, "utf8").split(/\r?\n/).find((l) => /^DATABASE_URL=/.test(l));
    const host = (line ?? "").replace(/^DATABASE_URL=["']?[a-z]+:\/\/[^@]*@/, "").split(/[/:?."']/)[0];
    return host.replace(/-pooler$/, "");
  } catch {
    return "";
  }
}

/** The dev and live databases' endpoint names, read from .env.development.local and .env.local in this folder. */
export function hostsFromEnvFiles(dir = process.cwd()) {
  return { dev: endpointIn(path.join(dir, ".env.development.local")), live: endpointIn(path.join(dir, ".env.local")) };
}

const names = (command, host) => host !== "" && command.toLowerCase().includes(host.toLowerCase());

/**
 * What to do about a command: null (no objection), or { decision: "ask" | "deny", reason }.
 * `mode` is "push" or "live".
 */
export function decide(command, mode, hosts = hostsFromEnvFiles()) {
  if (typeof command !== "string" || !command.trim()) return null;

  if (mode === "heredoc") {
    if (hasHeredoc(command)) {
      return {
        decision: "deny",
        reason:
          "A heredoc (<<EOF) is not allowed in the Bash tool on this project: it fails unpredictably here (\"unexpected EOF\", eaten backslashes, a hung command) and no size is safe. Write the file with the Write tool (a throwaway script goes in the scratchpad folder) and then run it, for example `python <file>` or `npx tsx <file>`. For a commit message use `printf '%s\\n' \"line one\" \"line two\" > \"$TEMP/msg.txt\"` and `git commit -F \"$TEMP/msg.txt\"` (see before-you-code, section 1).",
      };
    }
    return null;
  }

  if (mode === "push") {
    if (statements(command).some((s) => PUSH.test(s))) {
      return {
        decision: PUSH_DECISION,
        reason:
          "This is a `git push`. The project rule is never to push unless the user asks, so the user decides here. Approve only the push of the branch the user named.",
      };
    }
    return null;
  }

  if (mode === "live") {
    // Only the statements that really start a database-changing script count; words elsewhere (a commit message) do not.
    const writeStatements = statements(command).filter((st) => WRITES_DB.test(bareCommand(st)));
    const writes = writeStatements.length > 0;
    const dryRun = writes && writeStatements.every((st) => /--dry-run\b/.test(st));
    if (writeStatements.some((st) => /--allow-live\b/.test(st))) {
      return {
        decision: "deny",
        reason:
          "`--allow-live` lets a script write to the live database. Claude does not do that: the user runs live seeds and migrations themselves (see the live-migration-check skill).",
      };
    }
    if (writes && names(command, hosts.live)) {
      return {
        decision: "deny",
        reason: `This command names the live database host (${hosts.live}) and runs a script that writes. The user runs live migrations and seeds themselves.`,
      };
    }
    if (writes && !dryRun && !/\.env\.development\.local/i.test(command) && !names(command, hosts.dev)) {
      return {
        decision: "deny",
        reason:
          "This runs a migration, restore or seed without pointing it at the dev branch, and those scripts read the LIVE database address from .env.local. To run it on the dev branch, export DATABASE_URL from .env.development.local in the same command and check the host is the dev branch's first (see the add-migration skill). Live migrations are run by the user (live-migration-check prepares them).",
      };
    }
    return null;
  }

  return null;
}

// Run as a hook (not when imported by a test).
const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  try {
    const input = JSON.parse(readFileSync(0, "utf8"));
    const result = decide(input?.tool_input?.command, process.argv[2]);
    if (result) {
      process.stdout.write(
        JSON.stringify({
          hookSpecificOutput: {
            hookEventName: "PreToolUse",
            permissionDecision: result.decision,
            permissionDecisionReason: result.reason,
          },
        })
      );
    }
  } catch {
    // Unreadable input: no objection.
  }
}
