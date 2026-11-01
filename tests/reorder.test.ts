import { test } from "node:test";
import assert from "node:assert/strict";
import { dropIndex, movedTo } from "../lib/reorder";

const list = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
const ids = (l: { id: number }[]) => l.map((x) => x.id);

test("an item moves to a new place and the others keep their order", () => {
  assert.deepEqual(ids(movedTo(list, 1, 2)), [2, 3, 1, 4]);
  assert.deepEqual(ids(movedTo(list, 4, 0)), [4, 1, 2, 3]);
  assert.deepEqual(ids(movedTo(list, 3, 3)), [1, 2, 4, 3]);
});

test("a move to the place it already has, or to an item that is not there, changes nothing", () => {
  assert.equal(movedTo(list, 2, 1), list);
  assert.equal(movedTo(list, 99, 0), list);
});

test("a place past either end is the end", () => {
  assert.deepEqual(ids(movedTo(list, 2, 50)), [1, 3, 4, 2]);
  assert.deepEqual(ids(movedTo(list, 3, -5)), [3, 1, 2, 4]);
});

test("moving never loses or repeats an item", () => {
  for (const id of [1, 2, 3, 4]) {
    for (let to = -1; to <= 5; to++) {
      assert.deepEqual(ids(movedTo(list, id, to)).sort(), [1, 2, 3, 4]);
    }
  }
});

test("the drop place is the first row whose middle is below the pointer, or the last row", () => {
  const middles = [20, 60, 100, 140];
  assert.equal(dropIndex(middles, 5), 0);
  assert.equal(dropIndex(middles, 50), 1);
  assert.equal(dropIndex(middles, 99), 2);
  assert.equal(dropIndex(middles, 400), 3);
  assert.equal(dropIndex([], 10), 0);
});
