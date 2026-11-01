import { test } from "node:test";
import assert from "node:assert/strict";
import { circleMarkdown, shapeCircleExport, type CircleExportRows } from "../lib/export-circle-core";

const rows = (me: number): CircleExportRows => ({
  circle: { name: "Crossroads", created_at: "2026-10-01T10:00:00Z", owner_id: 1, claude_member_daily_limit: 15, claude_daily_limit: 100 },
  me: { user_id: me, joined_at: "2026-10-02T10:00:00Z", shares_with_host_at: "2026-10-02T10:00:00Z" },
  members: [
    { user_id: 1, name: "Rowan", joined_at: "2026-10-01T10:00:00Z" },
    { user_id: 2, name: "Sam", joined_at: "2026-10-02T10:00:00Z" },
  ],
  has_key: true,
  has_computer: true,
  key: { last4: "9XYZ", set_at: "2026-10-03T10:00:00Z" },
  computers: [{ name: "Kitchen laptop", created_at: "2026-10-04T10:00:00Z", last_used_at: null }],
  usage: [{ day: "2026-10-05", calls: 3 }],
  invites: [{ note: "for Sam", created_at: "2026-10-01T11:00:00Z", expires_at: "2026-10-08T11:00:00Z", status: "used", used_by_name: "Sam" }],
});

test("nobody in a circle gets an empty section", () => {
  assert.deepEqual(shapeCircleExport(null), { circle: null });
  assert.deepEqual(circleMarkdown({ circle: null }), []);
});

test("a member's export has their own agreement and usage, and nothing owner-only", () => {
  const out = shapeCircleExport(rows(2));
  assert.equal(out.circle?.your_role, "member");
  assert.equal(out.circle?.you_agreed_at, "2026-10-02T10:00:00Z");
  assert.deepEqual(out.circle?.your_claude_requests_through_the_circle, [{ day: "2026-10-05", requests: 3 }]);
  assert.equal(out.circle?.owner_only, null);
  assert.equal(out.circle?.claude_key_added, true);
  assert.equal(out.circle?.picture_computer_added, true);
  // Members are named, with their roles, as on the Circle page.
  assert.deepEqual(out.circle?.members.map((m) => [m.name, m.role]), [["Rowan", "owner"], ["Sam", "member"]]);
});

test("the owner's export shows the key's last four, the computers and the codes, never the secrets", () => {
  const out = shapeCircleExport(rows(1));
  assert.equal(out.circle?.your_role, "owner");
  assert.equal(out.circle?.owner_only?.claude_key_last_four, "9XYZ");
  assert.equal(out.circle?.owner_only?.picture_computers[0].name, "Kitchen laptop");
  assert.equal(out.circle?.owner_only?.invite_codes[0].used_by, "Sam");
  const text = JSON.stringify(out) + circleMarkdown(out).join("\n");
  for (const secret of [/sk-ant-/, /dsw_/, /code_hash/, /token_hash/, /ciphertext/]) assert.doesNotMatch(text, secret);
});

test("the Markdown says what the person agreed to, in plain words", () => {
  const md = circleMarkdown(shapeCircleExport(rows(2))).join("\n");
  assert.match(md, /## Your circle/);
  assert.match(md, /You agreed to use the circle's Claude key and picture computer on 2026-10-02/);
  assert.match(md, /2026-10-05: 3/);
  const withdrawn = rows(2);
  withdrawn.me.shares_with_host_at = null;
  assert.match(circleMarkdown(shapeCircleExport(withdrawn)).join("\n"), /You have not agreed/);
});
