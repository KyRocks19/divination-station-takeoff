// A ceiling on how many accounts a hosted copy holds, so the owner's database and bill stay within what they chose (docs/plan-editions.md).
// It limits people joining with a code; accounts an administrator makes by hand are not counted against it. No imports, so the tests use it.

export const DEFAULT_MAX_ACCOUNTS = 200;

/** The ceiling from MAX_ACCOUNTS: a whole number, 0 for no ceiling, otherwise 200. */
export function accountCap(envValue: string | undefined = process.env.MAX_ACCOUNTS): number {
  if (envValue === undefined || envValue.trim() === "") return DEFAULT_MAX_ACCOUNTS;
  const n = Number(envValue);
  return Number.isInteger(n) && n >= 0 ? n : DEFAULT_MAX_ACCOUNTS;
}

/** Whether one more person may join. A cap of 0 means no ceiling. */
export function mayJoin(accounts: number, cap: number = accountCap()): boolean {
  return cap === 0 || accounts < cap;
}

export const ACCOUNTS_FULL =
  "This copy of the app is full for now, so no new accounts can be made. Your code has not been used. Ask the person who gave it to you to tell the owner.";
