import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ToolGlyph from "../components/ui/ToolGlyph";
import { DIVINATION_KINDS } from "../lib/divination-kinds";

test("every tool has a drawn picture that is a decoration, in the text colour, with no inline style", () => {
  for (const kind of DIVINATION_KINDS) {
    const html = renderToStaticMarkup(createElement(ToolGlyph, { kind }));
    assert.match(html, /^<svg /, kind);
    assert.match(html, /aria-hidden="true"/, kind);
    assert.match(html, /stroke="currentColor"/, kind);
    assert.doesNotMatch(html, /style=/, `${kind} writes a style attribute`);
    assert.doesNotMatch(html, /#[0-9a-fA-F]{3,6}\b/, `${kind} has a hard-coded colour`);
    assert.ok(html.length > 200, `${kind} draws something`);
  }
});

test("the pictures differ from each other", () => {
  const drawn = DIVINATION_KINDS.map((kind) => renderToStaticMarkup(createElement(ToolGlyph, { kind })));
  assert.equal(new Set(drawn).size, DIVINATION_KINDS.length);
});

test("a size can be given, and the default is small", () => {
  assert.match(renderToStaticMarkup(createElement(ToolGlyph, { kind: "dice", className: "h-8 w-8" })), /class="h-8 w-8"/);
  assert.match(renderToStaticMarkup(createElement(ToolGlyph, { kind: "dice" })), /class="h-5 w-5"/);
});

test("the pieces list in the design notes names the picture piece", () => {
  assert.match(readFileSync("docs/design-system.md", "utf8"), /ToolGlyph\.tsx/);
});
