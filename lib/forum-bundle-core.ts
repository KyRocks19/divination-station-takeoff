// Moving a circle's forum from one host's copy to another's with a file (migration 099). No database and no imports, so the browser and the tests
// use it; lib/forum-bundle.ts reads and writes the rows. The rules: the file only ever ADDS. A post or comment whose id is already here is left
// as it is, so the same file can be brought in twice, or passed back and forth between two hosts, without making copies. Nothing is replaced or
// deleted, and a deletion on one host does not reach the other. Nothing in the file is trusted: every row is checked as if a stranger had typed it.
// Left out on purpose: attachments (they point at readings that stay with their author), posts and comments hidden by reports, and every account
// detail (passwords, sign-in codes, keys, invite codes).

export const BUNDLE_FORMAT = "divination-station-forum-bundle";

export const BUNDLE_LIMITS = {
  /** The largest file read, in bytes (the server's request limit is 16 MB). */
  bytes: 14_000_000,
  posts: 2000,
  commentsPerPost: 500,
  title: 200,
  body: 10_000,
  comment: 5000,
  author: 100,
} as const;

export interface BundleComment {
  id: string;
  /** The name shown beside the comment (display name, else username). */
  author: string;
  /** The author's username on the host that made the file; used to find the same person here. */
  username: string;
  content: string;
  written_at: string;
}

export interface BundlePost {
  id: string;
  author: string;
  username: string;
  title: string;
  body: string;
  written_at: string;
  comments: BundleComment[];
}

export interface ForumBundle {
  format: typeof BUNDLE_FORMAT;
  version: 1;
  exported_at: string;
  circle_name: string;
  /** How many posts had attachments, which a bundle does not carry. */
  posts_with_attachments_left_out: number;
  posts: BundlePost[];
}

const ID_RE = /^[0-9a-zA-Z-]{8,64}$/;

const str = (v: unknown, max: number): string | null => (typeof v === "string" && v.trim().length > 0 && v.length <= max ? v : null);
const when = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const t = new Date(v);
  return Number.isNaN(t.getTime()) ? null : t.toISOString();
};

export type CheckedBundle = { ok: true; bundle: ForumBundle; leftOut: { posts: number; comments: number } } | { ok: false; error: string };

/** Reads a parsed file. Rows that cannot be read are counted and left out; a file that is not a forum bundle is refused. */
export function checkBundle(raw: unknown): CheckedBundle {
  const r = raw as Record<string, unknown> | null;
  if (!r || typeof r !== "object" || r.format !== BUNDLE_FORMAT) {
    return { ok: false, error: "That is not a forum file from Divination Station. Use the file made by \"Save the forum to a file\" on another host." };
  }
  if (r.version !== 1) return { ok: false, error: "That file comes from a newer version of Divination Station. Update this copy and try again." };
  if (!Array.isArray(r.posts)) return { ok: false, error: "That file has no posts in it." };
  if (r.posts.length > BUNDLE_LIMITS.posts) return { ok: false, error: `That file has more than ${BUNDLE_LIMITS.posts} posts, which is more than can be brought in at once.` };

  let badPosts = 0;
  let badComments = 0;
  const posts: BundlePost[] = [];
  const seen = new Set<string>();
  for (const p of r.posts as Record<string, unknown>[]) {
    const id = typeof p?.id === "string" && ID_RE.test(p.id) ? p.id : null;
    const author = str(p?.author, BUNDLE_LIMITS.author);
    const username = str(p?.username, BUNDLE_LIMITS.author);
    const title = str(p?.title, BUNDLE_LIMITS.title);
    const body = str(p?.body, BUNDLE_LIMITS.body);
    const written_at = when(p?.written_at);
    if (!id || !author || !username || !title || !body || !written_at || seen.has(id)) {
      badPosts++;
      continue;
    }
    seen.add(id);
    const comments: BundleComment[] = [];
    const list = Array.isArray(p.comments) ? (p.comments as Record<string, unknown>[]).slice(0, BUNDLE_LIMITS.commentsPerPost) : [];
    if (Array.isArray(p.comments) && p.comments.length > list.length) badComments += p.comments.length - list.length;
    for (const c of list) {
      const cid = typeof c?.id === "string" && ID_RE.test(c.id) ? c.id : null;
      const cAuthor = str(c?.author, BUNDLE_LIMITS.author);
      const cUser = str(c?.username, BUNDLE_LIMITS.author);
      const content = str(c?.content, BUNDLE_LIMITS.comment);
      const cWhen = when(c?.written_at);
      if (!cid || !cAuthor || !cUser || !content || !cWhen || seen.has(cid)) {
        badComments++;
        continue;
      }
      seen.add(cid);
      comments.push({ id: cid, author: cAuthor, username: cUser, content, written_at: cWhen });
    }
    posts.push({ id, author, username, title, body, written_at, comments });
  }
  return {
    ok: true,
    leftOut: { posts: badPosts, comments: badComments },
    bundle: {
      format: BUNDLE_FORMAT,
      version: 1,
      exported_at: when(r.exported_at) ?? new Date().toISOString(),
      circle_name: typeof r.circle_name === "string" ? r.circle_name.slice(0, 60) : "",
      posts_with_attachments_left_out: Number.isFinite(Number(r.posts_with_attachments_left_out)) ? Math.max(0, Math.floor(Number(r.posts_with_attachments_left_out))) : 0,
      posts,
    },
  };
}

/** What is already in this copy, by id: a post's local id and whether it belongs to the importing circle, and the comment ids. */
export interface LocalForum {
  posts: Map<string, { id: number; inThisCircle: boolean }>;
  comments: Set<string>;
  /** Members of the importing circle by lower-case username → user id. */
  members: Map<string, number>;
}

export interface PlannedComment {
  bundle: BundleComment;
  userId: number;
  originAuthor: string | null;
}
export interface PlannedPost {
  bundle: BundlePost;
  userId: number;
  originAuthor: string | null;
  comments: PlannedComment[];
}
/** Comments to add to a post that is already here. */
export interface PlannedAddition {
  postId: number;
  comments: PlannedComment[];
}

export interface ForumImportPlan {
  newPosts: PlannedPost[];
  additions: PlannedAddition[];
  counts: { posts_add: number; posts_have: number; comments_add: number; comments_have: number; matched_authors: number; unmatched_authors: number; left_out: number };
}

/** Works out what an import would add. Pure: the same plan is checked and then applied. `importer` is the admin, who keeps anything whose author has no account here. */
export function planImport(bundle: ForumBundle, local: LocalForum, importer: number, leftOut: { posts: number; comments: number }): ForumImportPlan {
  const plan: ForumImportPlan = {
    newPosts: [],
    additions: [],
    counts: { posts_add: 0, posts_have: 0, comments_add: 0, comments_have: 0, matched_authors: 0, unmatched_authors: 0, left_out: leftOut.posts + leftOut.comments },
  };
  const who = (username: string, author: string) => {
    const id = local.members.get(username.toLowerCase());
    return id !== undefined ? { userId: id, originAuthor: null } : { userId: importer, originAuthor: author };
  };
  const tally = (rows: { originAuthor: string | null }[]) => {
    for (const r of rows) r.originAuthor === null ? plan.counts.matched_authors++ : plan.counts.unmatched_authors++;
  };
  for (const post of bundle.posts) {
    const here = local.posts.get(post.id);
    const fresh: PlannedComment[] = [];
    for (const c of post.comments) {
      if (local.comments.has(c.id)) {
        plan.counts.comments_have++;
        continue;
      }
      fresh.push({ bundle: c, ...who(c.username, c.author) });
    }
    if (here) {
      plan.counts.posts_have++;
      if (!here.inThisCircle) {
        // The same post id lives in another circle of this copy: do not move anything into it.
        plan.counts.left_out += fresh.length;
        continue;
      }
      if (fresh.length > 0) {
        plan.additions.push({ postId: here.id, comments: fresh });
        plan.counts.comments_add += fresh.length;
        tally(fresh);
      }
      continue;
    }
    const mine = who(post.username, post.author);
    plan.newPosts.push({ bundle: post, ...mine, comments: fresh });
    tally([mine, ...fresh]);
    plan.counts.posts_add++;
    plan.counts.comments_add += fresh.length;
  }
  return plan;
}

/** The name to show beside a post or comment: the name it was written under on another host, marked, or the local person's name. */
export function shownAuthor(row: { origin_author?: string | null; display_name?: string | null; username?: string | null }): string {
  if (row.origin_author) return `${row.origin_author} (from another host)`;
  return row.display_name || row.username || "";
}

/** The suggested name of the saved file: "forum-circle-name-2026-10-27.json". */
export function bundleFileName(circleName: string, at: Date): string {
  const slug = circleName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "circle";
  return `forum-${slug}-${at.toISOString().slice(0, 10)}.json`;
}
