import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { jsonBody } from "../lib/json-body";

// A body that is not JSON is the sender's mistake: the route answers 400, never a 500 from an unhandled request.json(). Routes
// read their body with jsonBody() (lib/own-http.ts), bodyOf(), a .catch, or inside a try.

const API = path.join(process.cwd(), "app", "api");

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const f = path.join(dir, n);
    return statSync(f).isDirectory() ? routeFiles(f) : n === "route.ts" ? [f] : [];
  });
}

test("no route reads a JSON body without handling one that is not JSON", () => {
  const bare: string[] = [];
  for (const file of routeFiles(API)) {
    const rel = path.relative(API, file).split(path.sep).join("/");
    const src = readFileSync(file, "utf8");
    for (const line of src.split("\n")) {
      // An assignment to a variable declared before a try block is fine: the try's catch answers 400.
      if (/await (request|req)\.json\(\)/.test(line) && !line.includes(".catch") && !/^\s*body = await/.test(line)) bare.push(`${rel}: ${line.trim()}`);
    }
  }
  assert.deepEqual(bare, []);
});

test("jsonBody answers 400 for a body that is not JSON and passes JSON through", async () => {
  const req = (body: string) => new Request("http://x/", { method: "POST", body });
  for (const bad of ["not json", "", "null", "3", '"text"']) {
    const out = await jsonBody(req(bad));
    assert.ok(out instanceof Response, bad);
    assert.equal(out.status, 400);
  }
  assert.deepEqual(await jsonBody(req('{"a":1}')), { a: 1 });
  assert.deepEqual(await jsonBody(req("[1,2]")), [1, 2]);
});
