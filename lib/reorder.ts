// Pure helpers for putting a list in a new order by dragging. No browser or database code, so they can be tested.

/** The list with the item that has `id` taken out and put at `index`. The same list comes back when nothing moves. */
export function movedTo<T extends { id: number }>(list: T[], id: number, index: number): T[] {
  const from = list.findIndex((x) => x.id === id);
  if (from < 0) return list;
  const target = Math.max(0, Math.min(list.length - 1, index));
  if (target === from) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(target, 0, item);
  return next;
}

/**
 * Where a dragged item belongs: the first row whose middle is below the pointer, or the last row.
 * `middles` are the vertical middles of the rows, top to bottom.
 */
export function dropIndex(middles: number[], pointerY: number): number {
  const i = middles.findIndex((m) => pointerY < m);
  return i < 0 ? Math.max(0, middles.length - 1) : i;
}
