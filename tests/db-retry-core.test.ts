// Checks on retrying a read and on the pool size (open item P7). Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { READ_RETRY_DELAYS_MS, isConnectionError, poolMax } from "../lib/db-retry-core";

test("connection errors are told apart from statement errors", () => {
  for (const e of [
    { code: "ECONNRESET" },
    { code: "57P01" },
    { code: "53300" },
    new Error("Connection terminated unexpectedly"),
    new Error("timeout exceeded when trying to connect"),
    new Error("Client has encountered a connection error and is not queryable"),
  ]) assert.equal(isConnectionError(e), true, JSON.stringify(e) + " " + String((e as Error).message ?? ""));
  for (const e of [{ code: "42P01" }, { code: "42703" }, { code: "23505" }, new Error('relation "x" does not exist'), new Error("syntax error"), null, "oops", undefined])
    assert.equal(isConnectionError(e), false, String(e));
});

test("a read is tried at most three times in all", () => {
  assert.equal(READ_RETRY_DELAYS_MS.length, 2);
  assert.ok(READ_RETRY_DELAYS_MS.every((d) => d > 0 && d < 1000));
});

test("DB_POOL_MAX is a whole number from 1 to 20, otherwise 10", () => {
  assert.equal(poolMax(undefined), 10);
  assert.equal(poolMax(""), 10);
  assert.equal(poolMax("5"), 5);
  assert.equal(poolMax("1"), 1);
  assert.equal(poolMax("20"), 20);
  assert.equal(poolMax("21"), 10);
  assert.equal(poolMax("0"), 10);
  assert.equal(poolMax("2.5"), 10);
  assert.equal(poolMax("many"), 10);
});

test("only a plain read is retried: the writing helpers do not use queryRead", () => {
  const db = readFileSync(path.join(__dirname, "..", "lib", "db.ts"), "utf8");
  assert.ok(/export async function queryRead/.test(db));
  const body = db.slice(db.indexOf("export async function query<"), db.indexOf("export async function queryRead"));
  assert.ok(!/queryRead|isConnectionError/.test(body), "query() itself never retries a sent statement");
  const session = readFileSync(path.join(__dirname, "..", "lib", "session.ts"), "utf8");
  assert.ok(session.includes('queryReadOne<AccountState>("SELECT'), "the account check is a SELECT read");
});
