-- A circle's code can make an account and join the circle in one step (ED5, docs/plan-editions.md, Challenge 4). The row of a code
-- remembers whether it made a new account, so a circle can be held to a ceiling of accounts made this way (lib/circles-core.ts,
-- MAX_ACCOUNTS_PER_CIRCLE) even after people leave or their accounts are deleted. Additive and safe to run twice. The code works without it:
-- until it is run, a circle code only adds people who already have an account, as before.
ALTER TABLE circle_invites ADD COLUMN IF NOT EXISTS made_account BOOLEAN NOT NULL DEFAULT FALSE;
