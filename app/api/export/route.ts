import { NextRequest } from "next/server";
import { listLayouts } from "@/lib/layouts";
import { query, queryOne } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getWheel } from "@/lib/calendar";
import { festivalsFor } from "@/lib/calendar-core";
import { getPrefs } from "@/lib/prefs";
import { describeSky, readingSky } from "@/lib/sky";
import { getCardById } from "@/lib/cards";
import { toPersonalMeaning } from "@/lib/personal-meanings";
import { collectToolExport, toolExportMarkdown } from "@/lib/export-tools";
import { collectDays, daysMarkdown } from "@/lib/export-days";
import { collectOwn } from "@/lib/export-own";
import { collectCircle } from "@/lib/export-circle";
import { circleMarkdown } from "@/lib/export-circle-core";
import { letterRowsForExport } from "@/lib/letters";
import { letterExportMarkdown, shapeLetterExport } from "@/lib/letters-core";
import { ownMarkdown } from "@/lib/export-own-core";
import { getRecent } from "@/lib/recent-searches";
import { recentMarkdown, shapeRecentExport } from "@/lib/recent-searches-core";
import { hiddenForExport } from "@/lib/hidden-links";
import { hiddenMarkdown, shapeHiddenExport } from "@/lib/hidden-links-core";
import { hiddenTakesMarkdown, keptMarkdown, ownMarkdownLines, shapeHiddenTakesExport, shapeKeptExport, shapeOwnExport } from "@/lib/divination-takes-core";
import { hiddenTakesForExport, keptTakesForExport, listOwnTakes } from "@/lib/divination-takes";
import { symbolLabel } from "@/lib/piece-labels";
import { getArchetype } from "@/lib/archetypes-data";
import type { DrawnCard, ClarifierMap } from "@/lib/reading-context";

const AUTHOR_NAMES: Record<string, string> = {
  user: "You",
  hiero: "Hiero (AI)",
  claude: "Hiero (AI)",
  guide: "Your Guide (AI)",
  sword: "Earlier AI entry",
  interview: "Interview with Hiero (AI)",
};

const KIND_NAMES: Record<string, string> = {
  impression: "first impression",
  lookback: "looking back",
};

// Everything the signed-in user has recorded, as one file: ?format=json (default) or ?format=md.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.userId;
  const format = new URL(request.url).searchParams.get("format") === "md" ? "md" : "json";

  const prefs = await getPrefs(userId);
  const user = await queryOne<{ username: string; display_name: string | null; sigil_data: string | null; theme: string | null }>(
    "SELECT username, display_name, sigil_data, theme FROM users WHERE id = $1",
    [userId]
  );

  const readingRows = await query("SELECT * FROM readings WHERE user_id = $1 ORDER BY created_at ASC", [userId]) as any[];
  const journalRows = await query(
    `SELECT j.* FROM journals j JOIN readings r ON r.id = j.reading_id
     WHERE r.user_id = $1 ORDER BY j.created_at ASC`,
    [userId]
  ) as any[];
  const readingTags = await query(
    `SELECT rt.reading_id, t.name FROM reading_tags rt
     JOIN tags t ON t.id = rt.tag_id WHERE t.user_id = $1`,
    [userId]
  ) as { reading_id: number; name: string }[];

  const readings = readingRows.map((r) => ({
    id: r.id,
    created_at: r.created_at,
    spread_name: r.spread_name,
    title: r.title,
    question: r.question,
    notes: r.notes,
    sky: readingSky(r, prefs.hemisphere),
    cards: JSON.parse(r.cards) as DrawnCard[],
    clarifiers: (r.clarifiers ? JSON.parse(r.clarifiers) : {}) as ClarifierMap,
    tags: readingTags.filter((t) => t.reading_id === r.id).map((t) => t.name),
    journals: journalRows
      .filter((j) => j.reading_id === r.id)
      .map((j) => ({
        id: j.id,
        created_at: j.created_at,
        author: j.author,
        kind: j.kind ?? "note",
        card_index: j.card_index,
        clarifier_index: j.clarifier_index,
        card_id: j.card_id ?? null,
        content: j.content,
      })),
  }));

  const meaningRows = await query(
    "SELECT * FROM card_customizations WHERE user_id = $1 ORDER BY card_id",
    [userId]
  ) as any[];
  const revisionRows = await query(
    "SELECT * FROM card_meaning_revisions WHERE user_id = $1 ORDER BY card_id, created_at ASC",
    [userId]
  ) as any[];
  const cardIds = [...new Set([...meaningRows, ...revisionRows].map((r) => r.card_id as string))];
  const cardMeanings = cardIds.flatMap((cardId) => {
    const card = getCardById(cardId);
    if (!card) return [];
    const currentRow = meaningRows.find((r) => r.card_id === cardId) ?? null;
    return [{
      card_id: cardId,
      card_name: card.name,
      current: toPersonalMeaning(card, currentRow),
      updated_at: currentRow?.updated_at ?? null,
      history: revisionRows
        .filter((r) => r.card_id === cardId)
        .map((r) => ({ saved_at: r.created_at, ...toPersonalMeaning(card, r) })),
    }];
  });

  const conceptNotes = await query(
    `SELECT c.display_name AS concept, n.content, n.updated_at
     FROM concept_notes n JOIN concepts c ON c.id = n.concept_id
     WHERE n.user_id = $1 ORDER BY c.display_name`,
    [userId]
  );
  // What Hiero wrote for this person about a concept (migration 084).
  const conceptDescriptions = await query(
    `SELECT c.display_name AS concept, d.body, d.generated_at
     FROM concept_descriptions_user d JOIN concepts c ON c.id = d.concept_id
     WHERE d.user_id = $1 ORDER BY c.display_name`,
    [userId]
  );
  const synthesisJournals = await query(
    "SELECT prompt, content, created_at FROM synthesis_journals WHERE user_id = $1 ORDER BY created_at ASC",
    [userId]
  ) as { prompt: string; content: string; created_at: string }[];
  // Layouts replaced spreads (tarot included); each position keeps its question, colour, and place on a board.
  const layouts = (await listLayouts(userId)).map((l) => ({
    name: l.name,
    description: l.description,
    question: l.question,
    created_at: l.created_at,
    positions: l.positions.map(({ name, prompt, color, x, y, rotation }) => ({ name, prompt, color, x, y, rotation })),
  }));
  const tags = await query("SELECT name, color FROM tags WHERE user_id = $1 ORDER BY name", [userId]);

  // Oracle decks, runes, ogham, dice, pendulum, and scrying: everything outside tarot.
  const tools = await collectToolExport(userId);
  const days = await collectDays(userId);
  // The person's own changes to the festivals on their calendar (migration 104), in their words.
  const calendarFestivals = festivalsFor(await getWheel(userId), prefs.hemisphere).map(({ name, date, own, hidden, usualName }) => ({ name, date, own, shown: !hidden, usual_name: usualName }));
  const own = await collectOwn(userId);
  const circle = await collectCircle(userId);
  // Letters: only this person's own words (their questions, the letters they sealed, their replies).
  const letters = shapeLetterExport(await letterRowsForExport(userId), userId);
  const recent = shapeRecentExport(await getRecent(userId));
  const hiddenLinks = shapeHiddenExport(await hiddenForExport(userId), (id) => symbolLabel(id)?.name ?? id);
  for (const h of hiddenLinks.hidden_shared_links) h.archetype = getArchetype(h.archetype)?.name ?? h.archetype;
  const keptTakes = shapeKeptExport(await keptTakesForExport(userId));
  const ownTakes = shapeOwnExport(await listOwnTakes(userId));
  const hiddenTakes = shapeHiddenTakesExport(await hiddenTakesForExport(userId));

  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "json") {
    const data = {
      exported_at: new Date().toISOString(),
      account: { username: user?.username, display_name: user?.display_name, sigil: user?.sigil_data ?? null },
      preferences: prefs,
      readings,
      card_meanings: cardMeanings,
      concept_notes: conceptNotes,
      concept_descriptions: conceptDescriptions,
      synthesis_journals: synthesisJournals,
      layouts,
      tags,
      colours: user?.theme ? JSON.parse(user.theme) : null,
      days,
      calendar_festivals: calendarFestivals,
      ...tools,
      ...own,
      ...circle,
      ...letters,
      ...recent,
      ...hiddenLinks,
      ...keptTakes,
      ...ownTakes,
      ...hiddenTakes,
    };
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="divination-station-${stamp}.json"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const day = (d: string | Date) => new Date(d).toISOString().slice(0, 10);
  const cardLine = (c: DrawnCard) => `${c.card_name}${c.reversed ? " (reversed)" : ""}`;
  const out: string[] = [
    `# Divination Station — ${user?.display_name || user?.username}`,
    ``,
    `Exported ${stamp}. ${readings.length} tarot reading${readings.length === 1 ? "" : "s"}, ${tools.other_tool_readings.length} from other tools.`,
  ];

  out.push(``, `## Readings`);
  for (const r of readings) {
    out.push(``, `### ${day(r.created_at)} — ${r.title || r.spread_name}`, ``);
    out.push(`- Spread: ${r.spread_name}`);
    if (r.question) out.push(`- Question: ${r.question}`);
    out.push(`- Sky: ${describeSky(r.sky)}${r.sky.recorded ? "" : " (worked out from the date; not recorded at the time)"}`);
    if (r.tags.length) out.push(`- Tags: ${r.tags.join(", ")}`);
    out.push(``, `Cards:`, ``);
    r.cards.forEach((c, i) => {
      out.push(`${i + 1}. ${c.position}: ${cardLine(c)}`);
      for (const cl of r.clarifiers[i] ?? []) out.push(`   - ${cl.position}: ${cardLine(cl)}`);
    });
    if (r.notes) out.push(``, r.notes);
    for (const j of r.journals) {
      const about = j.card_index != null && r.cards[j.card_index] ? `, ${r.cards[j.card_index].card_name}` : "";
      const kind = KIND_NAMES[j.kind] ? `, ${KIND_NAMES[j.kind]}` : "";
      out.push(``, `#### ${AUTHOR_NAMES[j.author] ?? j.author}${kind}${about} — ${day(j.created_at)}`, ``, j.content);
    }
  }

  out.push(...daysMarkdown(days));
  out.push(``, `## Festivals on your calendar`, ``);
  for (const f of calendarFestivals) out.push(`- ${f.date}: ${f.name}${f.usual_name ? ` (usually ${f.usual_name})` : ""}${f.own ? " (your own)" : ""}${f.shown ? "" : " (hidden)"}`);
  out.push(...ownMarkdown(own));
  out.push(...circleMarkdown(circle));
  out.push(...letterExportMarkdown(letters));
  out.push(...recentMarkdown(recent));
  out.push(...hiddenMarkdown(hiddenLinks));
  out.push(...ownMarkdownLines(ownTakes));
  out.push(...keptMarkdown(keptTakes));
  out.push(...hiddenTakesMarkdown(hiddenTakes));

  if (cardMeanings.length) {
    out.push(``, `## Your card meanings`);
    for (const m of cardMeanings) {
      out.push(``, `### ${m.card_name}`);
      const write = (label: string, fields: Record<string, string | null> | null) => {
        if (!fields) return;
        const upright = [fields.uprightKeywords, fields.uprightDescription].filter(Boolean).join(" — ");
        const reversed = [fields.reversedKeywords, fields.reversedDescription].filter(Boolean).join(" — ");
        if (!upright && !reversed) return;
        out.push(``, `**${label}**`, ``);
        if (upright) out.push(`- Upright: ${upright}`);
        if (reversed) out.push(`- Reversed: ${reversed}`);
      };
      write("Current", m.current as Record<string, string | null> | null);
      for (const h of m.history) write(`Saved ${day(h.saved_at)}`, h as unknown as Record<string, string | null>);
    }
  }

  if (conceptNotes.length) {
    out.push(``, `## Your concept notes`);
    for (const n of conceptNotes as { concept: string; content: string }[]) out.push(``, `### ${n.concept}`, ``, n.content);
  }

  if (synthesisJournals.length) {
    out.push(``, `## Synthesis journals`);
    for (const s of synthesisJournals) out.push(``, `### ${day(s.created_at)} — ${s.prompt}`, ``, s.content);
  }

  if (layouts.length) {
    out.push(``, `## Your layouts`);
    for (const l of layouts) {
      out.push(``, `### ${l.name}`, ``);
      if (l.description) out.push(l.description, ``);
      for (const p of l.positions) {
        out.push(`- ${p.name}${p.prompt ? `: ${p.prompt}` : ""}${p.color ? ` (${p.color})` : ""}`);
      }
    }
  }

  return new Response(out.join("\n") + "\n", {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="divination-station-${stamp}.md"`,
      "Cache-Control": "no-store",
    },
  });
}
