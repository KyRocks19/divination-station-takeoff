// The Node.js half of instrumentation.ts, loaded only when the server runs on Node.js. It lives in its own file because Next.js also compiles
// instrumentation.ts for the Edge runtime, which has no process.exit or process.once, and warns about every Node.js API it finds there.
// A copy that keeps its data in a folder on the computer (DS_DB_DIR) loads the secrets it made for itself the first time (lib/local-secrets.ts),
// so SESSION_SECRET is in the environment before the sign-in code reads it. A hosted copy has no DS_DB_DIR and nothing happens.
export async function registerNode() {
  // The Feathered edition refuses every connection that leaves this computer, before anything else runs (lib/network-guard.ts).
  if (process.env.NEXT_PUBLIC_FEATHERED === "1") {
    const { installNetworkGuard } = await import("./lib/network-guard");
    installNetworkGuard();
  }
  if (!process.env.DS_DB_DIR?.trim()) return;
  // Another copy already using this data folder: say so now, in the window the person started, and stop, instead of failing on the first page.
  const { lockBusyMessage } = await import("./lib/local-lock");
  const busy = lockBusyMessage(process.env.DS_DB_DIR.trim());
  if (busy) {
    console.error(`\n${busy}\n`);
    process.exit(1);
  }
  const { ensureLocalSecrets } = await import("./lib/local-secrets");
  const result = ensureLocalSecrets();
  if (result?.made.length) console.info(`[local-secrets] made ${result.made.join(" and ")}, saved in ${result.file}`);
  // Stopping (Ctrl+C, the window closed, the computer shutting down): a locked copy writes its last changes to its sealed file first (lib/local-db.ts).
  // The start files set NEXT_MANUAL_SIG_HANDLE so Next.js leaves these signals to this handler instead of exiting at once.
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
    process.once(signal, () => {
      void import("./lib/db")
        .then((m) => m.getLocalPool()?.end())
        .catch((err) => console.error(`[local-db] could not save before stopping: ${err instanceof Error ? err.message : err}`))
        .finally(() => process.exit(0));
    });
  }
  // A weekly backup, a little after start so the first pages are not kept waiting while the database is copied (lib/local-backup.ts decides whether one is due).
  const timer = setTimeout(() => {
    void import("./lib/local-backup").then((m) => m.weeklyBackupIfDue()).then((made) => made && console.info(`[local-backup] weekly backup made: ${made.name}`));
  }, 30_000);
  timer.unref();
}
