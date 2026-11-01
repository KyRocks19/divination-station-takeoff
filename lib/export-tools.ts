import { query } from "./db";
import { bytesOfRow, readArt } from "./art-store";
import { cleanTags } from "./gallery-tags-core";
import { DAILY_SHAPES } from "./remoteview-core";

// Everything a person has recorded with the tools other than tarot, for the data export. Tarot is exported by
// app/api/export/route.ts. Every query is scoped to the user; rows are plain data (no ids from other accounts).

type Row = Record<string, any>;

const PERSONAL_PREFIXES = [
  ["rune-", "runes"],
  ["ogham-", "ogham"],
  ["die-", "dice"],
  ["coin-", "dice"],
  ["hexagram-", "iching"],
  ["geomancy-", "geomancy"],
] as const;

export interface ToolExport {
  oracle_decks: Row[];
  /** The named style notes for pictures that the person saved in the picture-maker (migration 078). */
  picture_styles: Row[];
  other_tool_readings: Row[];
  own_meanings: Row[];
  pendulum_swings: Row[];
  /** Pictures kept in the gallery, each with its image as a data address. */
  art_gallery: Row[];
  /** What the person expected after a reading, the first words as written, and what they decided happened. */
  predictions: Row[];
  /** What the person wrote before opening a reading's meanings (migration 090), sealed as written, and how well they said it fitted. Steps they skipped are not listed. */
  first_guesses: Row[];
  /** Tarot practice with a sealed card (migration 092): each guessed card, the suit the person sensed and their words. */
  tarot_practice: Row[];
  /** Questions the AI companion asked that the person chose to keep (nothing the companion said is kept unless they pressed Keep). */
  companion_questions: Row[];
  /** Daily five-shape trials of blind-target practice (migration 086) that were judged; a waiting one is left out, so its target stays hidden. */
  blind_target_daily: Row[];
  /** The trial facts the person chose to share (migration 086): which trial, how many options, hit or miss, its place in their sequence, and the week. */
  blind_target_shared_facts: Row[];
}

function toolOfMeaningId(id: string): string | null {
  for (const [prefix, tool] of PERSONAL_PREFIXES) if (id.startsWith(prefix)) return tool;
  return null;
}

export async function collectToolExport(userId: number): Promise<ToolExport> {
  const [decks, cards, meanings, meaningRevs, fields, arts, gallery] = await Promise.all([
    query("SELECT * FROM oracle_decks WHERE user_id = $1 ORDER BY id", [userId]) as Promise<Row[]>,
    query("SELECT * FROM oracle_cards WHERE user_id = $1 ORDER BY deck_id, id", [userId]) as Promise<Row[]>,
    query("SELECT * FROM oracle_card_meanings WHERE user_id = $1 ORDER BY card_id, sort_order, id", [userId]) as Promise<Row[]>,
    query("SELECT * FROM oracle_card_meaning_revisions WHERE user_id = $1 ORDER BY created_at", [userId]) as Promise<Row[]>,
    query("SELECT * FROM oracle_card_fields WHERE user_id = $1 ORDER BY card_id, sort_order, id", [userId]) as Promise<Row[]>,
    query("SELECT * FROM oracle_card_art WHERE user_id = $1", [userId]) as Promise<Row[]>,
    query("SELECT * FROM oracle_gallery WHERE user_id = $1 ORDER BY created_at, id", [userId]) as Promise<Row[]>,
  ]);

  // Pictures kept as files on disk are read here; one that cannot be reached is exported without its image.
  const gallery_images = await Promise.all(gallery.map((g) => bytesOfRow(g as any, userId)));
  const art_pictures = new Map<number, Row>();
  for (const a of arts) art_pictures.set(a.card_id, await pictureOf(a, userId));

  const oracle_decks = decks.map((d) => ({
    name: d.name,
    description: d.description,
    made_of: d.form ?? "cards",
    picture_style_note: d.art_style ?? null,
    created_at: d.created_at,
    cards_can_land_upside_down: !!d.reversals,
    upside_down_chance: d.reversal_chance,
    cards: cards
      .filter((c) => c.deck_id === d.id)
      .map((c) => ({
        name: c.name,
        where_it_comes_from: c.origin,
        resting: !!c.resting,
        picture: art_pictures.get(c.id) ?? null,
        fields: fields.filter((f) => f.card_id === c.id).map((f) => ({ name: f.name, value: f.value })),
        meanings: meanings
          .filter((m) => m.card_id === c.id)
          .map((m) => ({
            label: m.label,
            content: m.content,
            for_upside_down_card: !!m.reversed,
            updated_at: m.updated_at,
            earlier_versions: meaningRevs
              .filter((r) => r.meaning_id === m.id)
              .map((r) => ({ saved_at: r.created_at, label: r.label, content: r.content })),
          })),
      })),
  }));

  // Readings of every tool except tarot, each with the rows its tool keeps and the writing about it.
  const [divs, pulls, pullCards, scrying, answers, runes, ogham, dice, journalRows] = await Promise.all([
    query("SELECT * FROM divinations WHERE user_id = $1 AND kind <> 'tarot' ORDER BY created_at, id", [userId]) as Promise<Row[]>,
    query("SELECT * FROM oracle_pulls WHERE user_id = $1", [userId]) as Promise<Row[]>,
    query("SELECT * FROM oracle_pull_cards WHERE user_id = $1 ORDER BY sort_order, id", [userId]) as Promise<Row[]>,
    query("SELECT * FROM scrying_sessions WHERE user_id = $1", [userId]) as Promise<Row[]>,
    query("SELECT * FROM pendulum_answers WHERE user_id = $1", [userId]) as Promise<Row[]>,
    query("SELECT * FROM rune_draws WHERE user_id = $1 ORDER BY sort_order, id", [userId]) as Promise<Row[]>,
    query("SELECT * FROM ogham_draws WHERE user_id = $1 ORDER BY sort_order, id", [userId]) as Promise<Row[]>,
    query("SELECT * FROM dice_throws WHERE user_id = $1 ORDER BY sort_order, id", [userId]) as Promise<Row[]>,
    query(
      `SELECT j.* FROM journals j JOIN divinations d ON d.id = j.divination_id
       WHERE d.user_id = $1 ORDER BY j.created_at, j.id`,
      [userId]
    ) as Promise<Row[]>,
  ]);

  const rowsOf = async (sql: string): Promise<Row[]> => (await query(sql, [userId])) as Row[];
  const divTags = await rowsOf(
    "SELECT dt.divination_id, t.name FROM divination_tags dt JOIN tags t ON t.id = dt.tag_id JOIN divinations d ON d.id = dt.divination_id WHERE d.user_id = $1 AND t.user_id = $1 ORDER BY t.name"
  );
  const [casts, charts, chartFigures, bibliomancyPulls, playingDraws, charmCasts, signNotes, rvTrials, blotRows] = await Promise.all([
    // I Ching, geomancy and bibliomancy (migrations 080 to 082).
    rowsOf("SELECT * FROM iching_casts WHERE user_id = $1"),
    rowsOf("SELECT * FROM geomancy_charts WHERE user_id = $1"),
    rowsOf("SELECT * FROM geomancy_figures WHERE user_id = $1 ORDER BY sort_order, id"),
    rowsOf("SELECT * FROM bibliomancy_pulls WHERE user_id = $1 ORDER BY sort_order, id"),
    // Playing cards, charm casting, signs and dreams, and blind-target practice (migration 085).
    rowsOf("SELECT * FROM playing_card_draws WHERE user_id = $1 ORDER BY sort_order, id"),
    rowsOf("SELECT * FROM charm_casts WHERE user_id = $1 ORDER BY sort_order, id"),
    rowsOf("SELECT divination_id, note_type, body, happened_on::text AS happened_on FROM sign_notes WHERE user_id = $1"),
    // A trial that has not been judged gives up neither its options nor its target, even to the person's own export: the columns are not selected for it.
    rowsOf(
      `SELECT divination_id, impression, ideogram, sealed_at, judged_at, choice_index,
              CASE WHEN judged_at IS NOT NULL THEN options END AS options,
              CASE WHEN judged_at IS NOT NULL THEN target_index END AS target_index
       FROM remoteview_trials WHERE user_id = $1`
    ),
    // Tea leaves (tasseomancy) and ink blots (migration 087): the kind of shape, the seed it is drawn from, and the tea chosen (migration 095).
    rowsOf("SELECT * FROM blot_casts WHERE user_id = $1"),
  ]);

  const readings = divs.map((d) => {
    const base: Row = {
      tool: d.kind,
      created_at: d.created_at,
      title: d.title,
      question: d.question,
      summary: d.summary,
      layout: d.layout_name ?? null,
      sky: d.sky ? safeJson(d.sky) : null,
    };
    switch (d.kind) {
      case "oracle": {
        const pull = pulls.find((p) => p.divination_id === d.id);
        base.deck = pull?.deck_name ?? null;
        base.cards = pullCards
          .filter((c) => c.divination_id === d.id)
          .map((c) => ({ name: c.card_name, upside_down: !!c.reversed, position: c.position_name ?? null }));
        break;
      }
      case "scrying": {
        const s = scrying.find((x) => x.divination_id === d.id);
        base.surface = s?.surface ?? null;
        base.minutes_looked = s?.minutes ?? null;
        break;
      }
      case "pendulum": {
        const a = answers.find((x) => x.divination_id === d.id);
        base.swing = a
          ? {
              name: a.swing_name,
              shape: a.shape,
              angle: a.angle === null ? null : a.angle + (a.angle_tenths ?? 0) / 10,
              your_words_then: a.meaning,
              chosen_by: a.chosen_by ?? "chance",
              ...(a.chosen_by === "motion" ? { phone_movement: { shape: a.motion_shape, angle: a.motion_angle } } : {}),
            }
          : null;
        break;
      }
      case "runes":
        base.runes = runes
          .filter((r) => r.divination_id === d.id)
          .map((r) => ({ name: r.rune_name, upside_down: !!r.reversed, position: r.position_name ?? null }));
        break;
      case "ogham":
        base.staves = ogham
          .filter((r) => r.divination_id === d.id)
          .map((r) => ({ name: r.stave_name, position: r.position_name ?? null }));
        break;
      case "iching": {
        const c = casts.find((x) => x.divination_id === d.id);
        base.cast = c
          ? {
              how: c.method,
              lines_from_the_bottom: String(c.lines).split("").map(Number),
              first_hexagram: { number: c.primary_number, name: c.primary_name },
              second_hexagram: c.relating_number ? { number: c.relating_number, name: c.relating_name } : null,
            }
          : null;
        break;
      }
      case "geomancy": {
        const c = charts.find((x) => x.divination_id === d.id);
        base.chart = c
          ? {
              how: c.method,
              mothers_as_dots: String(c.mothers).match(/.{4}/g),
              figures: chartFigures.filter((f) => f.divination_id === d.id).map((f) => ({ place: f.place, name: f.figure_name })),
            }
          : null;
        break;
      }
      case "bibliomancy":
        base.pulls = bibliomancyPulls
          .filter((x) => x.divination_id === d.id)
          .map((x) => ({ unit: x.unit, passage: x.passage, sentence_around_it: x.context ?? null, kind_of_writing: x.source_kind, found_in: x.source_label, written_at: x.source_when ?? null }));
        break;
      case "playingcards":
        base.cards = playingDraws.filter((x) => x.divination_id === d.id).map((x) => ({ card: x.card_name }));
        break;
      case "charms":
        base.charms = charmCasts
          .filter((x) => x.divination_id === d.id)
          .map((x) => ({ set: x.set_name, charm: x.charm_name, face: x.face, across_0_to_1000: x.x, down_0_to_1000: x.y }));
        break;
      case "tea":
      case "blots": {
        const b = blotRows.find((x) => x.divination_id === d.id);
        base.shape = b ? { kind: b.vessel === "cup" ? "tea leaves in a cup" : "ink blot", seed: b.seed, ...(b.tea ? { tea: b.tea } : {}) } : null;
        break;
      }
      case "signs": {
        const n = signNotes.find((x) => x.divination_id === d.id);
        base.note = n ? { type: n.note_type, text: n.body, happened_on: n.happened_on ?? null } : null;
        break;
      }
      case "remoteview": {
        const t = rvTrials.find((x) => x.divination_id === d.id);
        base.trial = t
          ? t.judged_at
            ? { impression: t.impression, ideogram: t.ideogram ?? null, options: t.options, target_number: Number(t.target_index) + 1, your_choice_number: Number(t.choice_index) + 1, chose_the_target: t.choice_index === t.target_index }
            : { in_progress: true, impression: t.impression ?? null }
          : null;
        break;
      }
      case "dice":
        base.results = dice
          .filter((r) => r.divination_id === d.id)
          .map((r) => ({ object: r.object, face: r.face, position: r.position_name ?? null }));
        break;
    }
    base.tags = divTags.filter((t) => t.divination_id === d.id).map((t) => t.name as string);
    base.journals = journalRows
      .filter((j) => j.divination_id === d.id)
      .map((j) => ({ created_at: j.created_at, author: j.author, kind: j.kind ?? "note", content: j.content }));
    return base;
  });

  // The person's own words for runes, ogham staves, and dice faces live beside the tarot meanings.
  const [custom, customRevs] = await Promise.all([
    query("SELECT * FROM card_customizations WHERE user_id = $1 ORDER BY card_id", [userId]) as Promise<Row[]>,
    query("SELECT * FROM card_meaning_revisions WHERE user_id = $1 ORDER BY card_id, created_at", [userId]) as Promise<Row[]>,
  ]);
  const wording = (r: Row) => ({
    keywords: r.upright_keywords,
    description: r.upright_description,
    upside_down_keywords: r.reversed_keywords,
    upside_down_description: r.reversed_description,
  });
  const ids = [...new Set([...custom, ...customRevs].map((r) => r.card_id as string))];
  const own_meanings = ids.flatMap((id) => {
    const tool = toolOfMeaningId(id);
    if (!tool) return [];
    const current = custom.find((r) => r.card_id === id);
    return [{
      tool,
      symbol: id,
      current: current ? { ...wording(current), updated_at: current.updated_at } : null,
      earlier_versions: customRevs
        .filter((r) => r.card_id === id)
        .map((r) => ({ saved_at: r.created_at, ...wording(r) })),
    }];
  });

  const [swings, swingRevs] = await Promise.all([
    query("SELECT * FROM pendulum_swings WHERE user_id = $1 ORDER BY sort_order, id", [userId]) as Promise<Row[]>,
    query("SELECT * FROM pendulum_swing_revisions WHERE user_id = $1 ORDER BY created_at", [userId]) as Promise<Row[]>,
  ]);
  const pendulum_swings = swings.map((s) => ({
    name: s.name,
    shape: s.shape,
    angle: s.angle === null ? null : s.angle + (s.angle_tenths ?? 0) / 10,
    in_play: !!s.in_play,
    your_words: s.meaning,
    earlier_wordings: swingRevs.filter((r) => r.swing_id === s.id).map((r) => ({ saved_at: r.created_at, content: r.content })),
  }));

  const predictionRows = (await query(
    `SELECT p.*, d.kind, COALESCE(NULLIF(d.title, ''), NULLIF(d.summary, ''), 'Reading') AS reading
     FROM predictions p JOIN divinations d ON d.id = p.divination_id WHERE p.user_id = $1 ORDER BY p.created_at, p.id`,
    [userId]
  )) as Row[];

  const guessRows = (await query(
    `SELECT g.guess, g.sealed_at, g.fit, g.fit_note, g.fit_at, g.confidence, g.logic, d.kind, COALESCE(NULLIF(d.title, ''), NULLIF(d.summary, ''), 'Reading') AS reading
     FROM reading_guesses g JOIN divinations d ON d.id = g.divination_id WHERE g.user_id = $1 AND NOT g.skipped ORDER BY g.sealed_at, g.divination_id`,
    [userId]
  )) as Row[];

  const noteRows = (await query(
    `SELECT n.companion_name, n.content, n.created_at, COALESCE(NULLIF(d.title, ''), NULLIF(d.summary, ''), 'Reading') AS reading
     FROM companion_notes n JOIN divinations d ON d.id = n.divination_id WHERE n.user_id = $1 ORDER BY n.created_at, n.id`,
    [userId]
  )) as Row[];

  const practiceRows = (await query(
    "SELECT card_id, guess_suit, guess_words, created_at FROM tarot_practice WHERE user_id = $1 AND guessed_at IS NOT NULL ORDER BY created_at, id",
    [userId]
  )) as Row[];

  const picture_styles = (await query("SELECT name, text, created_at FROM art_styles WHERE user_id = $1 ORDER BY created_at, id", [userId])) as Row[];

  // Only judged daily trials: before the choice, the target and the secret number are not read even for the person's own export.
  const dailyRows = (await query(
    "SELECT target_index, choice_index, nonce, seal_hash, created_at, judged_at FROM remoteview_daily WHERE user_id = $1 AND judged_at IS NOT NULL ORDER BY created_at, id",
    [userId]
  )) as Row[];
  const factRows = (await query(
    `SELECT f.tool, f.options, f.hit, f.seq, f.week::text AS week FROM remoteview_facts f JOIN remoteview_share s ON s.token = f.token
     WHERE s.user_id = $1 ORDER BY f.tool, f.seq, f.id`,
    [userId]
  )) as Row[];

  return {
    oracle_decks,
    picture_styles,
    other_tool_readings: readings,
    companion_questions: noteRows.map((n) => ({
      reading: n.reading,
      asked_by: `${n.companion_name} (an AI)`,
      asked_at: n.created_at,
      questions: n.content,
    })),
    predictions: predictionRows.map((p) => ({
      tool: p.kind,
      reading: p.reading,
      written_at: p.created_at,
      first_words: p.original_text,
      current_words: p.text,
      look_back_on: p.check_on ? String(p.check_on instanceof Date ? p.check_on.toISOString().slice(0, 10) : p.check_on).slice(0, 10) : null,
      what_happened: p.outcome,
      in_your_words: p.outcome_note,
      looked_back_at: p.resolved_at,
    })),
    first_guesses: guessRows.map((g) => ({
      tool: g.kind,
      reading: g.reading,
      sealed_at: g.sealed_at,
      guess: g.guess,
      logical_mind_said: g.logic ?? null,
      how_sure: g.confidence ?? null,
      fit: g.fit,
      fit_note: g.fit_note,
      fit_at: g.fit_at,
    })),
    tarot_practice: practiceRows.map((t) => ({ card: t.card_id, sensed_suit: t.guess_suit, words: t.guess_words, at: t.created_at })),
    blind_target_daily: dailyRows.map((r) => ({
      started_at: r.created_at,
      chosen_at: r.judged_at,
      target: DAILY_SHAPES[r.target_index] ?? null,
      your_choice: r.choice_index === null ? null : DAILY_SHAPES[r.choice_index] ?? null,
      chose_the_target: r.choice_index === r.target_index,
      seal: r.seal_hash,
      secret_number: r.nonce,
    })),
    blind_target_shared_facts: factRows.map((f) => ({ trial: f.tool === "daily5" ? "daily five shapes" : "four options", options: f.options, hit: f.hit, number_in_your_sequence: f.seq, week_of: f.week })),
    own_meanings,
    pendulum_swings,
    art_gallery: gallery.map((g, i) => ({
      description: g.alt ?? null,
      words_it_was_made_from: g.prompt ?? null,
      made_with: g.made_with ?? null,
      tags: cleanTags(g.tags),
      added_at: g.created_at,
      image: gallery_images[i] ? `data:${g.mime};base64,${gallery_images[i]!.toString("base64")}` : null,
      ...(gallery_images[i] ? {} : { note: "The picture file is stored on the computer that runs the app and could not be read." }),
    })),
  };
}

/** A picture for the export: a drawing's strokes, or an upload as a data address, with the person's description. */
async function pictureOf(art: Row, userId: number): Promise<Row> {
  const base = { description: art.alt ?? null, made_with: art.made_with ?? null, updated_at: art.updated_at };
  const unreachable = { note: "The picture file is stored on the computer that runs the app and could not be read." };
  if (art.kind === "drawing") {
    const text: string | null = art.strokes ?? (await readArt(art.file_key, userId))?.toString("utf8") ?? null;
    return text ? { kind: "drawing", ...base, drawing: safeJson(text) } : { kind: "drawing", ...base, drawing: null, ...unreachable };
  }
  const bytes = await bytesOfRow(art as any, userId);
  return bytes
    ? { kind: "upload", ...base, image: `data:${art.mime};base64,${bytes.toString("base64")}` }
    : { kind: "upload", ...base, image: null, ...unreachable };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** The same data as readable Markdown, appended to the tarot export. */
export function toolExportMarkdown(data: ToolExport): string[] {
  const day = (d: string | Date) => new Date(d).toISOString().slice(0, 10);
  const out: string[] = [];

  for (const deck of data.oracle_decks) {
    out.push(``, `## ${deck.made_of === "cards" ? "Oracle deck" : "Oracle set of " + deck.made_of}: ${deck.name}`);
    if (deck.description) out.push(``, deck.description);
    if (deck.picture_style_note) out.push(``, `Style note for pictures: ${deck.picture_style_note}`);
    for (const c of deck.cards as Row[]) {
      out.push(``, `### ${c.name}${c.resting ? " (resting)" : ""}`);
      if (c.where_it_comes_from) out.push(``, `Where it comes from: ${c.where_it_comes_from}`);
      for (const f of c.fields as Row[]) if (f.value) out.push(``, `**${f.name}:** ${f.value}`);
      for (const m of c.meanings as Row[]) {
        out.push(``, `**${m.label || "Meaning"}${m.for_upside_down_card ? " (upside down)" : ""}:** ${m.content}`);
        for (const e of m.earlier_versions as Row[]) out.push(`- Saved ${day(e.saved_at)}: ${e.content}`);
      }
    }
  }

  if (data.picture_styles.length) {
    out.push(``, `## Your saved styles for pictures`, ``);
    for (const s of data.picture_styles) out.push(`- ${s.name}: ${s.text}`);
  }

  if (data.companion_questions.length) {
    out.push(``, `## Questions the companion asked that you kept`);
    for (const q of data.companion_questions) out.push(``, `### ${q.reading} (${q.asked_by}, ${day(q.asked_at)})`, ``, `${q.questions}`);
  }

  if (data.predictions.length) {
    out.push(``, `## Predictions`);
    for (const p of data.predictions) {
      out.push(``, `### ${p.tool}: ${p.reading}`, ``, `${p.current_words}`);
      if (p.first_words !== p.current_words) out.push(``, `First written (${day(p.written_at)}): ${p.first_words}`);
      if (p.what_happened) out.push(``, `What happened: ${p.what_happened}${p.in_your_words ? ` — ${p.in_your_words}` : ""}`);
    }
  }

  if (data.first_guesses.length) {
    out.push(``, `## What you sensed first`);
    for (const g of data.first_guesses) {
      out.push(``, `### ${g.tool}: ${g.reading}`, ``, `${g.guess}`, ``, `Sealed ${day(g.sealed_at)}.`);
      if (g.logical_mind_said) out.push(``, `Your logical mind said: ${g.logical_mind_said}`);
      if (g.fit) out.push(``, `How well it fitted: ${g.fit} of 5${g.fit_note ? ` — ${g.fit_note}` : ""}`);
    }
  }

  if (data.art_gallery.length) {
    out.push(``, `## Gallery`, ``, `${data.art_gallery.length} picture${data.art_gallery.length === 1 ? "" : "s"} are kept in your gallery. The pictures themselves are in the JSON export.`);
    for (const g of data.art_gallery) {
      const tags = cleanTags(g.tags);
      if (g.description || tags.length) out.push(`- ${g.description ?? "(no description)"}${tags.length ? ` [tags: ${tags.join(", ")}]` : ""}`);
    }
  }

  if (data.own_meanings.length) {
    out.push(``, `## Your own meanings for runes, ogham, dice, coins, hexagrams and geomantic figures`);
    for (const m of data.own_meanings) {
      out.push(``, `### ${m.symbol} (${m.tool})`);
      const line = (label: string, w: Row | null) => {
        if (!w) return;
        const text = [w.keywords, w.description].filter(Boolean).join(" — ");
        const flip = [w.upside_down_keywords, w.upside_down_description].filter(Boolean).join(" — ");
        if (text) out.push(`- ${label}: ${text}`);
        if (flip) out.push(`- ${label}, upside down: ${flip}`);
      };
      line("Current", m.current);
      for (const h of m.earlier_versions as Row[]) line(`Saved ${day(h.saved_at)}`, h);
    }
  }

  if (data.pendulum_swings.some((s) => s.your_words)) {
    out.push(``, `## Your pendulum swings`);
    for (const s of data.pendulum_swings) {
      if (!s.your_words) continue;
      out.push(``, `- ${s.name ?? s.shape}${s.in_play ? "" : " (not in play)"}: ${s.your_words}`);
    }
  }

  if (data.other_tool_readings.length) {
    out.push(``, `## Readings from other tools`);
    for (const r of data.other_tool_readings) {
      out.push(``, `### ${day(r.created_at)} — ${r.tool}${r.title ? `: ${r.title}` : ""}`, ``);
      if (r.question) out.push(`- Question: ${r.question}`);
      if (r.layout) out.push(`- Layout: ${r.layout}`);
      if (r.summary) out.push(`- Result: ${r.summary}`);
      // The longer text of a note of a sign or dream, and the impression of a blind-target trial, are more than the one-line result.
      const note = r.note as Row | null | undefined;
      if (note?.text) out.push(`- ${note.type === "dream" ? "Dream" : "Sign"}${note.happened_on ? ` (${note.happened_on})` : ""}: ${note.text}`);
      const trial = r.trial as Row | null | undefined;
      if (trial?.impression) out.push(`- Impression: ${trial.impression}`);
      for (const j of r.journals as Row[]) out.push(``, `#### ${j.author === "user" ? "You" : j.author === "interview" ? "Interview with Hiero (AI)" : j.author} — ${day(j.created_at)}`, ``, j.content);
    }
  }

  if (data.blind_target_daily.length) {
    const hits = data.blind_target_daily.filter((t) => t.chose_the_target).length;
    out.push(``, `## Daily blind-target trials`, ``, `${hits} of ${data.blind_target_daily.length} chose the target (guessing alone is right one time in five).`, ``);
    for (const t of data.blind_target_daily) out.push(`- ${day(t.started_at)}: you chose ${t.your_choice ?? "nothing"}, the target was ${t.target}${t.chose_the_target ? " (the target)" : ""}`);
  }

  if (data.blind_target_shared_facts.length) {
    out.push(``, `## Blind-target facts you shared`, ``, `Each line is all that is kept for a shared trial. No writing, drawing, target, time of day or name.`, ``);
    for (const f of data.blind_target_shared_facts) out.push(`- Week of ${f.week_of}, ${f.trial}, trial ${f.number_in_your_sequence}: ${f.hit ? "hit" : "miss"}`);
  }
  return out;
}
