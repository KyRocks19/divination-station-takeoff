import { test } from "node:test";
import assert from "node:assert/strict";
import { HIDDEN_COMMENT_NOTE, HIDE_AFTER, maskHidden, maySeeHidden, shouldHide, visibleSql } from "../lib/forum-reports";

test("an item is hidden at five different reporters, not before", () => {
  assert.equal(HIDE_AFTER, 5);
  assert.equal(shouldHide(0), false);
  assert.equal(shouldHide(HIDE_AFTER - 1), false);
  assert.equal(shouldHide(HIDE_AFTER), true);
  assert.equal(shouldHide(10), true);
});

test("only the author and the owner may see a hidden item", () => {
  assert.equal(maySeeHidden(7, 7, false), true);
  assert.equal(maySeeHidden(7, 8, true), true);
  assert.equal(maySeeHidden(7, 8, false), false);
  assert.equal(maySeeHidden(7, null, false), false);
});

test("a hidden comment shows a plain note to everyone but its author and the owner; visible comments are untouched", () => {
  const rows = [
    { id: 1, user_id: 7, content: "kind words", hidden_at: null },
    { id: 2, user_id: 7, content: "reported words", hidden_at: "2026-10-14T10:00:00Z" },
  ];
  const other = maskHidden(rows, 9, false);
  assert.equal(other[0].content, "kind words");
  assert.equal(other[0].hidden, false);
  assert.equal(other[1].content, HIDDEN_COMMENT_NOTE);
  assert.equal(other[1].hidden, true);
  assert.ok(!JSON.stringify(other).includes("reported words"));
  assert.equal(maskHidden(rows, 7, false)[1].content, "reported words");
  assert.equal(maskHidden(rows, 1, true)[1].content, "reported words");
  assert.equal(maskHidden(rows, 1, true)[1].hidden, true);
  assert.ok(!JSON.stringify(maskHidden(rows, null, false)).includes("reported words"));
});

test("a copy without the hidden column leaves every comment as it was", () => {
  const rows = [{ id: 1, user_id: 7, content: "x" }];
  assert.deepEqual(maskHidden(rows, 9, false), [{ id: 1, user_id: 7, content: "x", hidden: false }]);
});

test("the visibility clause lets the author and the owner through", () => {
  assert.equal(visibleSql("fp", "$1", "$2"), "(fp.hidden_at IS NULL OR fp.user_id = $1 OR $2::boolean)");
});
