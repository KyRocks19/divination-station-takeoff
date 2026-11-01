// Who may read, write and remove forum posts now that the forum belongs to a circle (docs/plan-editions.md). No imports and no database,
// so the tests use it. The circle column on forum posts is migration 074.

export interface ForumViewer {
  userId: number;
  isAdmin: boolean;
  /** The circle the person belongs to, if any. */
  circleId: number | null;
  /** Whether they own that circle. */
  isLeader: boolean;
}

export interface ForumPostScope {
  user_id: number;
  circle_id?: number | null;
}

/** A post is read by its author, by the owner of the app (to look at what was reported) and by members of the circle it was written in. */
export function canSeePost(v: ForumViewer, post: ForumPostScope): boolean {
  if (post.user_id === v.userId || v.isAdmin) return true;
  return v.circleId !== null && post.circle_id === v.circleId;
}

/** Writing in the forum needs a circle (nothing else changes for a person without one). */
export function canPost(v: ForumViewer): boolean {
  return v.circleId !== null;
}

/** Removing someone else's post or comment: the owner of the app, or the leader of the circle it was written in. */
export function canModerate(v: ForumViewer, post: ForumPostScope): boolean {
  if (v.isAdmin) return true;
  return v.isLeader && v.circleId !== null && post.circle_id === v.circleId;
}

/**
 * How many different people must report something before it is hidden. The old fixed five can never be reached in a circle of fewer than
 * six people (nobody reports their own writing), so it follows the circle's size: a quarter of the members, at least 2 and at most 5.
 */
export function hideThreshold(members: number | null | undefined): number {
  if (!members || members < 1) return 5;
  return Math.min(5, Math.max(2, Math.ceil(members / 4)));
}

/**
 * A WHERE fragment for a list of posts: the person's circle's posts and their own. Parameters are appended to `params`. `alias` is the
 * forum_posts alias in the query.
 */
export function listScope(v: ForumViewer, alias: string, params: unknown[]): string {
  params.push(v.userId);
  const me = `$${params.length}`;
  if (v.circleId === null) return `${alias}.user_id = ${me}`;
  params.push(v.circleId);
  return `(${alias}.circle_id = $${params.length} OR ${alias}.user_id = ${me})`;
}

export const NO_CIRCLE_NOTE = "The forum is shared inside a circle. Join a circle with a code from its owner to read and write here. Everything else in the app works without one.";
