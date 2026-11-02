import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { PoolClient } from "pg";
import { markOwnDraw } from "../lib/own-draw";
import { cleanReading } from "../lib/import-core";

/** A pretend database client that records each statement and can fail the update like a copy without migration 106. */
function fakeClient(fail?: { code: string }) {
  const sent: string[] = [];
  const client = {
    query: async (sql: string) => {
      sent.push(sql.split(" ").slice(0, 3).join(" "));
      if (fail && sql.startsWith("UPDATE")) throw Object.assign(new Error("no column"), fail);
      return { rows: [] };
    },
  } as unknown as PoolClient;
  return { client, sent };
}

test("a recorded reading is marked inside a savepoint", async () => {
  const { client, sent } = fakeClient();
  await markOwnDraw(client, [4, 5]);
  assert.deepEqual(sent, ["SAVEPOINT own_draw", "UPDATE readings SET", "RELEASE SAVEPOINT own_draw"]);
});

test("nothing to mark sends nothing", async () => {
  const { client, sent } = fakeClient();
  await markOwnDraw(client, []);
  assert.deepEqual(sent, []);
});

test("before migration 106 the mark is skipped and the transaction stays usable", async () => {
  const { client, sent } = fakeClient({ code: "42703" });
  await markOwnDraw(client, [1]);
  assert.deepEqual(sent, ["SAVEPOINT own_draw", "UPDATE readings SET", "ROLLBACK TO SAVEPOINT"]);
});

test("any other failure is not hidden", async () => {
  const { client } = fakeClient({ code: "57014" });
  await assert.rejects(markOwnDraw(client, [1]));
});

test("the mark comes back in through an import, and only when it was true", () => {
  const base = { created_at: "2026-11-01T10:00:00Z", spread_name: "One card", cards: [{ position: "Now", card_id: "major-0", card_name: "The Fool", reversed: false }] };
  assert.equal(cleanReading({ ...base, own_draw: true })?.own_draw, true);
  assert.equal(cleanReading({ ...base, own_draw: "yes" })?.own_draw, false);
  assert.equal(cleanReading(base)?.own_draw, false);
});

test("recorded readings open at once on every tool that can record one", () => {
  const reveal = readFileSync("components/reveal/Reveal.tsx", "utf8");
  assert.match(reveal, /if \(ownDraw\) return "shown";/);
  assert.match(readFileSync("components/tools/ReadingShell.tsx", "utf8"), /p\.ownDraw \? "off"/);
  assert.match(readFileSync("components/iching/CastView.tsx", "utf8"), /ownDraw=\{cast\.method === "entered"\}/);
  assert.match(readFileSync("components/geomancy/ChartView.tsx", "utf8"), /ownDraw=\{initialChart\.method === "entered"\}/);
  const tarot = readFileSync("app/readings/[id]/page.tsx", "utf8");
  assert.match(tarot, /useGuess\(guessId\)/);
  assert.match(tarot, /ownDraw=\{ownDraw\}/);
  assert.match(readFileSync("app/readings/new/page.tsx", "utf8"), /saveReading\(drawnCards, true\)/);
});
