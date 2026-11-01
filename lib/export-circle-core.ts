// A person's circle membership for the data export (JSON and Markdown), with no database code so it can be tested; lib/export-circle.ts reads the rows.
// What goes in is what the Circle page already shows this person, plus their own Claude request counts. It never holds a key, a token or a code,
// and it never holds anything another member wrote (members are listed by name and join date only, as on the page).

export interface CircleExportRows {
  circle: { name: string; created_at: string; owner_id: number; claude_member_daily_limit: number; claude_daily_limit: number };
  me: { user_id: number; joined_at: string; shares_with_host_at: string | null };
  members: { user_id: number; name: string; joined_at: string }[];
  has_key: boolean;
  has_computer: boolean;
  key: { last4: string; set_at: string } | null;
  /** Only filled in for the circle's owner. */
  computers: { name: string; created_at: string; last_used_at: string | null }[];
  usage: { day: string; calls: number }[];
  invites: { note: string | null; created_at: string; expires_at: string; status: string; used_by_name: string | null }[];
}

export interface CircleExport {
  circle: null | {
    name: string;
    made_at: string;
    your_role: "owner" | "member";
    you_joined_at: string;
    /** When you agreed to use the circle's Claude key and picture computer; null when you have not (or withdrew). */
    you_agreed_at: string | null;
    members: { name: string; role: "owner" | "member"; joined_at: string }[];
    claude_key_added: boolean;
    picture_computer_added: boolean;
    claude_daily_limit_per_member: number;
    claude_daily_limit_for_circle: number;
    /** Your own Claude requests made through the circle's key, per day. */
    your_claude_requests_through_the_circle: { day: string; requests: number }[];
    /** Only for the circle's owner. Never the key, the tokens or the codes themselves. */
    owner_only: null | {
      claude_key_last_four: string | null;
      claude_key_added_at: string | null;
      picture_computers: { name: string; added_at: string; last_used_at: string | null }[];
      invite_codes: { note: string | null; made_at: string; works_until: string; status: string; used_by: string | null }[];
    };
  };
}

export const EMPTY_CIRCLE_EXPORT: CircleExport = { circle: null };

/** Shapes the rows. Pure. */
export function shapeCircleExport(rows: CircleExportRows | null): CircleExport {
  if (!rows) return EMPTY_CIRCLE_EXPORT;
  const isOwner = rows.circle.owner_id === rows.me.user_id;
  return {
    circle: {
      name: rows.circle.name,
      made_at: rows.circle.created_at,
      your_role: isOwner ? "owner" : "member",
      you_joined_at: rows.me.joined_at,
      you_agreed_at: rows.me.shares_with_host_at,
      members: rows.members.map((m) => ({ name: m.name, role: m.user_id === rows.circle.owner_id ? "owner" : "member", joined_at: m.joined_at })),
      claude_key_added: rows.has_key,
      picture_computer_added: rows.has_computer,
      claude_daily_limit_per_member: rows.circle.claude_member_daily_limit,
      claude_daily_limit_for_circle: rows.circle.claude_daily_limit,
      your_claude_requests_through_the_circle: rows.usage.map((u) => ({ day: u.day, requests: u.calls })),
      owner_only: isOwner
        ? {
            claude_key_last_four: rows.key?.last4 ?? null,
            claude_key_added_at: rows.key?.set_at ?? null,
            picture_computers: rows.computers.map((c) => ({ name: c.name, added_at: c.created_at, last_used_at: c.last_used_at })),
            invite_codes: rows.invites.map((i) => ({ note: i.note, made_at: i.created_at, works_until: i.expires_at, status: i.status, used_by: i.used_by_name })),
          }
        : null,
    },
  };
}

const day = (d: string | Date) => new Date(d).toISOString().slice(0, 10);

/** The same data as readable Markdown lines. Nothing is written when the person is in no circle. */
export function circleMarkdown(data: CircleExport): string[] {
  const c = data.circle;
  if (!c) return [];
  const out: string[] = [``, `## Your circle`, ``, `**${c.name}**, made ${day(c.made_at)}. You ${c.your_role === "owner" ? "run it" : "are a member"}; you joined ${day(c.you_joined_at)}.`];
  out.push(``, c.you_agreed_at ? `You agreed to use the circle's Claude key and picture computer on ${day(c.you_agreed_at)}.` : `You have not agreed to use the circle's Claude key or picture computer.`);
  out.push(``, `Members: ${c.members.map((m) => `${m.name}${m.role === "owner" ? " (runs the circle)" : ""}, joined ${day(m.joined_at)}`).join("; ")}.`);
  out.push(``, `The circle has ${c.claude_key_added ? "a Claude key" : "no Claude key"} and ${c.picture_computer_added ? "a picture computer" : "no picture computer"}. Limits: ${c.claude_daily_limit_per_member} Claude requests a day for each person, ${c.claude_daily_limit_for_circle} for the whole circle.`);
  if (c.your_claude_requests_through_the_circle.length) {
    out.push(``, `Your Claude requests through the circle's key:`, ``);
    for (const u of c.your_claude_requests_through_the_circle) out.push(`- ${day(u.day)}: ${u.requests}`);
  }
  if (c.owner_only) {
    const o = c.owner_only;
    if (o.claude_key_last_four) out.push(``, `Your Claude key for the circle ends in ${o.claude_key_last_four} (added ${o.claude_key_added_at ? day(o.claude_key_added_at) : "earlier"}). The key itself is never exported.`);
    if (o.picture_computers.length) {
      out.push(``, `Picture computers:`, ``);
      for (const p of o.picture_computers) out.push(`- ${p.name}, added ${day(p.added_at)}${p.last_used_at ? `, last used ${day(p.last_used_at)}` : ""}`);
    }
    if (o.invite_codes.length) {
      out.push(``, `Invite codes (the codes themselves are not kept, so they are not exported):`, ``);
      for (const i of o.invite_codes) out.push(`- ${i.note ?? "no note"}: ${i.status}${i.used_by ? ` by ${i.used_by}` : ""}, made ${day(i.made_at)}`);
    }
  }
  return out;
}
