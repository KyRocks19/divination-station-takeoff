import test from "node:test";
import assert from "node:assert/strict";
import { connectionStringFor, sslFor } from "../lib/db-ssl";

const NEON = "postgresql://u:p@ep-x.neon.tech/db";

test("sslmode=require, prefer and verify-ca are written as verify-full (same checked connection, no pg warning)", () => {
  for (const mode of ["require", "prefer", "verify-ca"]) {
    assert.equal(connectionStringFor(`${NEON}?sslmode=${mode}`), `${NEON}?sslmode=verify-full`);
  }
});

test("other parameters are kept when the mode is rewritten", () => {
  assert.equal(connectionStringFor(`${NEON}?channel_binding=require&sslmode=require`), `${NEON}?channel_binding=require&sslmode=verify-full`);
});

test("verify-full, disable, no-verify and no mode are left exactly as they are", () => {
  for (const url of [`${NEON}?sslmode=verify-full`, `${NEON}?sslmode=disable`, `${NEON}?sslmode=no-verify`, NEON, "postgresql://u:p@localhost/db"]) {
    assert.equal(connectionStringFor(url), url);
  }
});

test("a missing or unreadable address passes through", () => {
  assert.equal(connectionStringFor(undefined), undefined);
  assert.equal(connectionStringFor("not a url"), "not a url");
});

test("the certificate is still checked for a hosted database, and not for this computer", () => {
  assert.deepEqual(sslFor(`${NEON}?sslmode=require`), { rejectUnauthorized: true });
  assert.equal(sslFor("postgresql://u:p@localhost/db"), false);
});
