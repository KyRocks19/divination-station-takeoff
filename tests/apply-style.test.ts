import test from "node:test";
import assert from "node:assert/strict";
import { applyStyle, cssName, cssValue, styleRef } from "../lib/apply-style";

function fakeElement() {
  const props = new Map<string, string>();
  return { props, style: { setProperty: (n: string, v: string) => void props.set(n, v), removeProperty: (n: string) => { const old = props.get(n) ?? ""; props.delete(n); return old; } } };
}

test("property names become CSS names, and custom properties stay as they are", () => {
  assert.equal(cssName("borderLeft"), "border-left");
  assert.equal(cssName("backgroundColor"), "background-color");
  assert.equal(cssName("--speed"), "--speed");
  assert.equal(cssName("WebkitTouchCallout"), "-webkit-touch-callout");
});

test("numbers are pixels, except where a number means itself", () => {
  assert.equal(cssValue("width", 140), "140px");
  assert.equal(cssValue("width", 0), "0");
  assert.equal(cssValue("opacity", 0.5), "0.5");
  assert.equal(cssValue("fontWeight", 700), "700");
  assert.equal(cssValue("--delay", 2), "2");
  assert.equal(cssValue("width", "40%"), "40%");
});

test("nothing, false, an empty string and a number that is not a number leave the property off", () => {
  for (const v of [undefined, null, false, "", NaN, Infinity]) assert.equal(cssValue("color", v as never), null);
});

test("styles are set, and the ones no longer given are taken off", () => {
  const el = fakeElement();
  applyStyle(el, { width: 10, backgroundColor: "#fff", color: "red" });
  assert.deepEqual([...el.props], [["width", "10px"], ["background-color", "#fff"], ["color", "red"]]);
  applyStyle(el, { width: 20, color: undefined });
  assert.deepEqual([...el.props], [["width", "20px"]]);
});

test("a style someone else set is not touched", () => {
  const el = fakeElement();
  el.style.setProperty("cursor", "grab");
  applyStyle(el, { width: 1 });
  applyStyle(el, {});
  assert.equal(el.props.get("cursor"), "grab");
});

test("the ref callback sets styles on an element and ignores null", () => {
  const el = fakeElement();
  const ref = styleRef({ height: "50%" });
  ref(null);
  ref(el as never);
  assert.equal(el.props.get("height"), "50%");
});
