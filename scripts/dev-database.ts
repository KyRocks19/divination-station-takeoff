// Tells the maintenance scripts whether DATABASE_URL points at your dev database, so they never write to or read
// the live one by mistake. The dev database is the one named by DATABASE_URL in .env.development.local (the file
// `npm run dev` reads), for example postgres://<user>:<password>@ep-your-dev-branch-123456.eu-central-1.aws.neon.tech/db.
// Set DEV_DATABASE_HOST_PREFIX instead (for example ep-your-dev-branch) if you keep no such file.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const hostOf = (url: string) => url.replace(/^[a-z]+:\/\/[^@]*@/, "").split(/[/:?]/)[0];

/** The dev database's host, or its first letters, or "" when neither the file nor the setting names one. */
export function devHost(root = process.cwd()): string {
  const prefix = process.env.DEV_DATABASE_HOST_PREFIX?.trim();
  if (prefix) return prefix;
  const file = join(root, ".env.development.local");
  if (!existsSync(file)) return "";
  const line = readFileSync(file, "utf8").split(/\r?\n/).find((l) => /^DATABASE_URL=/.test(l));
  return line ? hostOf(line.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "")) : "";
}

export function isDevDatabase(host: string, root = process.cwd()): boolean {
  const dev = devHost(root);
  return dev !== "" && host.startsWith(dev);
}

export const NOT_DEV =
  "This is not the dev database (DATABASE_URL in .env.development.local, or a host starting with DEV_DATABASE_HOST_PREFIX).";
