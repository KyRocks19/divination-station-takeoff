import { test } from "node:test";
import assert from "node:assert/strict";
import { AccountStateCache, sessionStands, type AccountState } from "../lib/account-state";
import { originAllowed } from "../lib/origin";

const live: AccountState = { is_admin: 0, disabled: 0, session_version: 0 };

test("a session stands only for a live account with the same session version", () => {
  assert.equal(sessionStands(live, undefined), true); // made before migration 039
  assert.equal(sessionStands(live, 0), true);
  assert.equal(sessionStands({ ...live, session_version: 2 }, 2), true);
  assert.equal(sessionStands({ ...live, session_version: 2 }, 1), false); // password changed since
  assert.equal(sessionStands({ ...live, session_version: 1 }, undefined), false);
  assert.equal(sessionStands({ ...live, disabled: 1 }, 0), false); // switched off
  assert.equal(sessionStands(null, 0), false); // deleted
});

test("the account state is remembered only for a short time", () => {
  const cache = new AccountStateCache(1000);
  assert.equal(cache.get(1, 0), undefined);
  cache.set(1, live, 0);
  assert.deepEqual(cache.get(1, 999), { state: live });
  assert.equal(cache.get(1, 1000), undefined);
  cache.set(2, null, 0); // a deleted account is remembered too
  assert.deepEqual(cache.get(2, 10), { state: null });
  cache.forget(2);
  assert.equal(cache.get(2, 10), undefined);
});

test("a change of data from another website is refused; the app's own pages and tools without an Origin are allowed", () => {
  const h = (o: Record<string, string>) => new Headers(o);
  assert.equal(originAllowed("GET", h({ origin: "https://evil.example" }), "app.example"), true); // reads are not changes
  assert.equal(originAllowed("POST", h({ origin: "https://app.example" }), "app.example"), true);
  assert.equal(originAllowed("POST", h({ origin: "https://evil.example" }), "app.example"), false);
  assert.equal(originAllowed("DELETE", h({ origin: "null" }), "app.example"), false);
  assert.equal(originAllowed("POST", h({ origin: "not a url" }), "app.example"), false);
  assert.equal(originAllowed("POST", h({}), "app.example"), true); // the Claude tool key, scripts
  assert.equal(originAllowed("POST", h({ origin: "https://sub.app.example" }), "app.example"), false);
  // Behind a proxy the browser's host arrives in x-forwarded-host.
  assert.equal(originAllowed("PATCH", h({ origin: "https://pc.tail.ts.net:10000", "x-forwarded-host": "pc.tail.ts.net:10000" }), "localhost:3000"), true);
  assert.equal(originAllowed("POST", h({ origin: "https://other.example" }), "app.example", "other.example"), true); // ALLOWED_ORIGINS
});

import { SlidingWindow, bodyTooBig, idList, MAX_JSON_BYTES } from "../lib/limits";

test("a big body is refused except on the routes that carry pictures", () => {
  assert.equal(bodyTooBig("/api/journals", String(MAX_JSON_BYTES + 1)), true);
  assert.equal(bodyTooBig("/api/journals", String(MAX_JSON_BYTES)), false);
  assert.equal(bodyTooBig("/api/journals", null), false);
  assert.equal(bodyTooBig("/api/oracle/cards/12/art", "9000000"), false);
  assert.equal(bodyTooBig("/api/oracle/gallery", "9000000"), false);
  assert.equal(bodyTooBig("/api/oracle/cards/12/meanings", "9000000"), true);
});

test("a sliding window lets through its limit, then refuses until time has passed", () => {
  const w = new SlidingWindow(3, 1000);
  assert.deepEqual([0, 1, 2, 3].map((i) => w.allow("a", i)), [true, true, true, false]);
  assert.equal(w.allow("b", 4), true); // another person is not affected
  assert.equal(w.allow("a", 1001), true); // the first three have left the window
});

test("an id list keeps only whole positive numbers, without repeats, up to the limit", () => {
  assert.deepEqual(idList([1, "2", 2, -3, 1.5, "x", null, 4], 10), [1, 2, 4]);
  assert.deepEqual(idList([1, 2, 3, 4], 2), [1, 2]);
  assert.deepEqual(idList("nope", 5), []);
});
