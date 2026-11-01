// The names file of a leader's copy (open item H2.2): only whole names, never this computer or a pattern, nothing added before the leader's
// acknowledgement, a damaged file counts as empty, and the proxy adds the file's names only in host mode.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EMPTY_HOST_NAMES, MAX_HOST_NAMES, changeHostNames, cleanHostEntry, hostNamesFileFor, parseHostNames } from "../lib/host-names-core";
import { allowedHostNames, hostAllowed, withHostNames } from "../lib/host-guard";

const name = (raw: string) => {
  const c = cleanHostEntry(raw);
  return c.ok ? c.name : null;
};

test("a pasted address becomes one whole host name", () => {
  assert.equal(name("https://My-PC.tail1234.ts.net/"), "my-pc.tail1234.ts.net");
  assert.equal(name("my-pc.tail1234.ts.net:443"), "my-pc.tail1234.ts.net");
  assert.equal(name("  circle.example.org.  "), "circle.example.org");
  assert.equal(name("100.101.102.103"), "100.101.102.103");
});

test("this computer, wildcards, other addresses and odd shapes are refused", () => {
  for (const bad of ["", "localhost", "127.0.0.1", "[::1]", "0.0.0.0", "*.ts.net", "ts", "192.168.1.5", "10.0.0.1", "user@my-pc.ts.net", "my_pc.ts.net", "-a.ts.net", "a..b", "1.2.3"]) {
    assert.equal(name(bad), null, bad);
  }
});

test("nothing is added before the leader confirms, and the list stays short and without repeats", () => {
  assert.equal(changeHostNames(EMPTY_HOST_NAMES, { add: "my-pc.tail1234.ts.net" }).ok, false);
  const ack = changeHostNames(EMPTY_HOST_NAMES, { acknowledge: true }, new Date("2026-10-22T08:00:00Z"));
  assert.ok(ack.ok);
  if (!ack.ok) return;
  assert.equal(ack.file.acknowledgedAt, "2026-10-22T08:00:00.000Z");
  let file = ack.file;
  for (let i = 0; i < MAX_HOST_NAMES; i++) {
    const r = changeHostNames(file, { add: `pc${i}.tail1234.ts.net` });
    assert.ok(r.ok);
    if (r.ok) file = r.file;
  }
  const again = changeHostNames(file, { add: "pc0.tail1234.ts.net" });
  assert.ok(again.ok && again.file.names.length === MAX_HOST_NAMES, "a repeat changes nothing");
  assert.equal(changeHostNames(file, { add: "one-more.tail1234.ts.net" }).ok, false);
  const removed = changeHostNames(file, { remove: "pc0.tail1234.ts.net" });
  assert.ok(removed.ok && !removed.file.names.includes("pc0.tail1234.ts.net"));
  assert.equal(changeHostNames(file, {}).ok, false);
});

test("the file is checked again when read: a damaged or edited file never lets a bad name in", () => {
  assert.deepEqual(parseHostNames("not json"), EMPTY_HOST_NAMES);
  assert.deepEqual(parseHostNames(null), EMPTY_HOST_NAMES);
  const read = parseHostNames(JSON.stringify({ names: ["ok.tail1.ts.net", "localhost", "*.ts.net", "evil", 7, "ok.tail1.ts.net"], acknowledgedAt: "nonsense" }));
  assert.deepEqual(read, { names: ["ok.tail1.ts.net"], acknowledgedAt: null });
  assert.equal(hostNamesFileFor("/x/my-data/database/"), "/x/my-data/database.allowed-hosts.json");
});

test("the guard adds the file's names to a local copy's own, and the proxy does it only in host mode", () => {
  const base = allowedHostNames("local", undefined);
  const names = withHostNames(base, ["my-pc.tail1234.ts.net"]);
  assert.equal(hostAllowed("my-pc.tail1234.ts.net", names), true);
  assert.equal(hostAllowed("localhost:47831", names), true);
  assert.equal(hostAllowed("my-pc.tail1234.ts.net", base), false, "the base set is not changed");
  assert.equal(withHostNames(null, ["x.ts.net"]), null);
  assert.match(readFileSync("proxy.ts", "utf8"), /hostMode \? withHostNames\(allowedHosts, readHostNames\(\)\.names\) : allowedHosts/);
});

test("the setup route is for the admin, from this computer, on a copy with a data folder", () => {
  const src = readFileSync("app/api/local/host/route.ts", "utf8");
  assert.match(src, /if \(!session\.isAdmin\)/);
  assert.match(src, /reachedOnThisComputer\(request\.headers\.get\("host"\), request\.headers\)/);
  assert.match(src, /if \(!localDbDir\(\)\)/);
});
