import { test } from "node:test";
import assert from "node:assert/strict";
import { allowedHostNames, cameThroughProxy, hostAllowed, hostName, tailnetAddress } from "../lib/host-guard";
import { readFileSync } from "node:fs";
import { editionOf } from "../lib/edition";

test("hostName drops the port, scheme, path and capitals", () => {
  assert.equal(hostName("LocalHost:3000"), "localhost");
  assert.equal(hostName("https://Example.ts.net:10000/path?x=1"), "example.ts.net");
  assert.equal(hostName("[::1]:3000"), "[::1]");
  assert.equal(hostName("[::1]"), "[::1]");
  assert.equal(hostName(""), "");
  assert.equal(hostName(null), "");
});

test("the edition is hosted unless it says local", () => {
  assert.equal(editionOf(undefined), "hosted");
  assert.equal(editionOf(""), "hosted");
  assert.equal(editionOf("anything"), "hosted");
  assert.equal(editionOf(" Local "), "local");
});

test("a hosted copy with no ALLOWED_HOSTS has no guard", () => {
  assert.equal(allowedHostNames(undefined, undefined), null);
  assert.equal(hostAllowed("anything.example", allowedHostNames(undefined, "")), true);
});

test("a local copy answers to loopback names only", () => {
  const a = allowedHostNames("local", undefined);
  assert.ok(a);
  for (const ok of ["localhost", "localhost:47831", "127.0.0.1:3000", "[::1]:3000"]) assert.equal(hostAllowed(ok, a), true, ok);
  for (const bad of ["evil.example", "evil.example:3000", "localhost.evil.example", "127.0.0.1.evil.example", "", null, undefined]) {
    assert.equal(hostAllowed(bad as string, a), false, String(bad));
  }
});

test("names the person adds are allowed, with or without a port or scheme", () => {
  const a = allowedHostNames("local", "my-pc.tail1234.ts.net, https://other.ts.net:10000/");
  assert.equal(hostAllowed("my-pc.tail1234.ts.net:10000", a), true);
  assert.equal(hostAllowed("other.ts.net", a), true);
  assert.equal(hostAllowed("evil.example", a), false);
});

test("a hosted copy turns the guard on by setting ALLOWED_HOSTS, and then loopback is not added", () => {
  const a = allowedHostNames(undefined, "app.example.com");
  assert.ok(a);
  assert.equal(hostAllowed("app.example.com", a), true);
  assert.equal(hostAllowed("localhost:3000", a), false);
});

test("tailnetAddress knows Tailscale and Headscale addresses and nothing else", () => {
  for (const ip of ["100.64.0.1", "100.101.102.103", "100.127.255.254", "::ffff:100.80.1.2", "fd7a:115c:a1e0::1", "FD7A:115C:A1E0:ab12::5"]) assert.equal(tailnetAddress(ip), true, ip);
  for (const ip of ["127.0.0.1", "::1", "::ffff:127.0.0.1", "172.17.0.1", "192.168.1.20", "100.63.255.255", "100.128.0.1", "10.0.0.1", "", "fd00::1"]) assert.equal(tailnetAddress(ip), false, ip);
});

test("a request a proxy passed on from another computer is told apart from one made on this computer", () => {
  // What Next.js gives a route for a browser on this computer, and for Docker (the request comes from the bridge address).
  assert.equal(cameThroughProxy(new Headers({ "x-forwarded-for": "127.0.0.1" })), false);
  assert.equal(cameThroughProxy(new Headers({ "x-forwarded-for": "::ffff:127.0.0.1" })), false);
  assert.equal(cameThroughProxy(new Headers({ "x-forwarded-for": "172.17.0.1" })), false);
  assert.equal(cameThroughProxy(new Headers()), false);
  // tailscale serve names the person; a reverse proxy adds their tailnet address; a forged X-Forwarded-For gets the real one appended.
  assert.equal(cameThroughProxy(new Headers({ "tailscale-user-login": "friend@example.com", "x-forwarded-for": "127.0.0.1" })), true);
  assert.equal(cameThroughProxy(new Headers({ "x-forwarded-for": "100.101.102.103" })), true);
  assert.equal(cameThroughProxy(new Headers({ "x-forwarded-for": "127.0.0.1, 100.101.102.103" })), true);
  assert.equal(cameThroughProxy(new Headers({ forwarded: "for=100.101.102.103" })), true);
});

test("every place that asks whether a request came from this computer also asks whether a proxy passed it on", () => {
  for (const file of ["app/api/setup/route.ts", "app/api/local/host/route.ts", "app/host/page.tsx"]) {
    const src = readFileSync(file, "utf8");
    const calls = src.match(/reachedOnThisComputer\([^)]*\)[^)]*\)/g) ?? [];
    assert.ok(calls.length > 0, file);
    for (const call of calls) assert.match(call, /, (request\.headers|requestHeaders)\)$/, file);
  }
});
