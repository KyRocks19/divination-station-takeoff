// Checks on the Feathered edition's outgoing-connection guard (lib/network-guard.ts). It changes this test process's network functions, which is why it
// has a file of its own (each test file runs in its own process). Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import dns from "node:dns";
import http from "node:http";
import net from "node:net";
import { OutsideConnectionRefused, connectTarget, installNetworkGuard, isLoopback } from "../lib/network-guard";

test("only names and addresses on this computer count as this computer", () => {
  for (const h of ["localhost", "LOCALHOST", "127.0.0.1", "127.1.2.3", "::1", "[::1]", "::ffff:127.0.0.1", "app.localhost", undefined, ""]) assert.ok(isLoopback(h), String(h));
  for (const h of ["example.com", "10.0.0.2", "192.168.1.4", "128.0.0.1", "0.0.0.0", "localhost.example.com", "my-pc.tail1234.ts.net", "::2"]) {
    assert.ok(!isLoopback(h), h);
  }
});

test("the connect call's target is read from every form Node accepts; a socket path is local", () => {
  assert.deepEqual(connectTarget([{ host: "example.com", port: 443 }]), { host: "example.com" });
  assert.deepEqual(connectTarget([[{ host: "example.com", port: 443 }, () => {}]]), { host: "example.com" });
  assert.deepEqual(connectTarget([443, "example.com"]), { host: "example.com" });
  assert.deepEqual(connectTarget([443]), { host: undefined });
  assert.equal(connectTarget(["/tmp/x.sock"]), null);
  assert.equal(connectTarget([{ path: "\\\\.\\pipe\\x" }]), null);
});

test("once installed, nothing outside this computer can be reached, and this computer still can", async () => {
  const lines: string[] = [];
  installNetworkGuard((l) => lines.push(l));

  await assert.rejects(fetch("https://example.com/"), OutsideConnectionRefused);
  assert.throws(() => net.connect(443, "example.com"), OutsideConnectionRefused);
  assert.throws(() => net.connect({ host: "93.184.216.34", port: 80 }), OutsideConnectionRefused);
  assert.throws(() => dns.lookup("example.com", () => {}), OutsideConnectionRefused);
  await assert.rejects(dns.promises.lookup("example.com"), OutsideConnectionRefused);
  assert.throws(() => dns.resolve4("example.com", () => {}), OutsideConnectionRefused);
  await new Promise<void>((done, fail) => {
    const req = http.get("http://example.com/", () => fail(new Error("it connected")));
    req.on("error", (err) => (err instanceof OutsideConnectionRefused ? done() : fail(err)));
  }).catch((err) => assert.ok(err instanceof OutsideConnectionRefused, String(err)));
  assert.ok(lines.length >= 6 && lines.every((l) => l.startsWith("[network-guard]")), "every refusal is logged");

  const server = http.createServer((_req, res) => res.end("here"));
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  const { port } = server.address() as net.AddressInfo;
  try {
    assert.equal(await (await fetch(`http://127.0.0.1:${port}/`)).text(), "here");
    assert.equal(await (await fetch(`http://localhost:${port}/`)).text(), "here");
  } finally {
    server.close();
  }
});
