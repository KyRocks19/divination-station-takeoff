// Gives every account its own copies of the app's starting spreads as layouts, then links each past tarot reading
// to the layout that came from the spread it used. Safe to run again. Run with: npx tsx scripts/seed-starter-layouts.ts
import fs from "node:fs";

for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

async function main() {
  const { query } = await import("../lib/db");
  const { addStarterLayouts } = await import("../lib/starter-layouts");

  const users = await query<{ id: number; username: string }>("SELECT id, username FROM users ORDER BY id");
  for (const u of users) {
    const made = await addStarterLayouts(u.id);
    console.log(`${u.username}: ${made} starter layouts made`);
  }

  // A reading made with a starting spread points at the person's copy of that spread, by name.
  const linked = await query<{ id: number }>(
    `UPDATE readings r SET layout_id = l.id
     FROM spreads s, layouts l
     WHERE r.spread_id = s.id AND s.is_preset = 1 AND r.layout_id IS NULL
       AND l.user_id = r.user_id AND l.name = s.name
     RETURNING r.id`
  );
  console.log(`readings linked to a layout: ${linked.length}`);
  await query(
    `UPDATE divinations d SET layout_id = r.layout_id, layout_name = r.spread_name
     FROM readings r
     WHERE d.reading_id = r.id AND r.layout_id IS NOT NULL AND d.layout_id IS NULL`
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
