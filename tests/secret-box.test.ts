import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { lastFour, masterKey, open, seal } from "../lib/secret-box";

const key = randomBytes(32);

test("a sealed secret opens with the same key and aad", () => {
  const box = seal("sk-ant-api03-abcdef", "circle:4", key);
  assert.equal(open(box, "circle:4", key), "sk-ant-api03-abcdef");
});

test("the stored bytes do not contain the secret, and two seals of one secret differ", () => {
  const a = seal("sk-ant-api03-abcdef", "circle:4", key);
  const b = seal("sk-ant-api03-abcdef", "circle:4", key);
  assert.ok(!a.ciphertext.includes(Buffer.from("abcdef")));
  assert.notDeepEqual(a.iv, b.iv);
  assert.notDeepEqual(a.ciphertext, b.ciphertext);
});

test("it does not open with another circle, another key, or a changed byte", () => {
  const box = seal("sk-ant-api03-abcdef", "circle:4", key);
  assert.equal(open(box, "circle:5", key), null);
  assert.equal(open(box, "circle:4", randomBytes(32)), null);
  const flipped = Buffer.from(box.ciphertext);
  flipped[0] ^= 1;
  assert.equal(open({ ...box, ciphertext: flipped }, "circle:4", key), null);
  const tag = Buffer.from(box.tag);
  tag[0] ^= 1;
  assert.equal(open({ ...box, tag }, "circle:4", key), null);
});

test("the master key must be exactly 32 bytes, as hex or base64", () => {
  assert.equal(masterKey({}), null);
  assert.equal(masterKey({ CIRCLE_KEY_SECRET: "" }), null);
  assert.equal(masterKey({ CIRCLE_KEY_SECRET: "too short" }), null);
  assert.equal(masterKey({ CIRCLE_KEY_SECRET: randomBytes(16).toString("base64") }), null);
  assert.deepEqual(masterKey({ CIRCLE_KEY_SECRET: key.toString("base64") }), key);
  assert.deepEqual(masterKey({ CIRCLE_KEY_SECRET: key.toString("hex") }), key);
});

test("only the last four characters are shown", () => {
  assert.equal(lastFour("sk-ant-api03-abcdWXYZ"), "WXYZ");
});
