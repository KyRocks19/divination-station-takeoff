// Writes docs/webliography.md from lib/sources.ts, so the file and the Sources pages cannot drift apart.
// Run: npx tsx scripts/export-webliography.ts
import fs from "node:fs";
import path from "node:path";
import { DIVINATION_KIND_LABELS } from "../lib/divination-kinds";
import { CHECK_OUT, PRIMARY_CHECKED_ON, PRIMARY_SOURCES, SECONDARY_SOURCES, type PrimarySource } from "../lib/primary-sources";
import { CITES, DEFAULT_BASIS, SOURCES, SOURCES_CHECKED_ON, TOOL_GUIDES, getSource, type Level, type Source, type ToolGuideId } from "../lib/sources";

const WORDS: Record<Level, string> = { yes: "Yes", partly: "Partly", no: "No", unclear: "Not settled" };
const ORDER: ToolGuideId[] = ["tarot", "oracle", "scrying", "pendulum", "runes", "ogham", "dice", "across"];
const title = (id: ToolGuideId) => (id === "across" ? "Across every tool" : DIVINATION_KIND_LABELS[id]);
const slug = (id: ToolGuideId) => `tool-${id}`;

const shown = new Set<string>();
const out: string[] = [];

function entry(s: Source, toolId: ToolGuideId): string {
  if (shown.has(s.id)) {
    const first = ORDER.find((t) => [...TOOL_GUIDES[t].start, ...TOOL_GUIDES[t].record, ...TOOL_GUIDES[t].more].includes(s.id) && t !== toolId);
    return `- **${s.short}**: listed in full under [${first ? title(first) : "another tool"}](#${first ? slug(first) : ""}).\n`;
  }
  shown.add(s.id);
  const lines = [
    `#### ${s.short}`,
    "",
    `${s.cite}`,
    "",
    `*${s.kind}* · [${s.urlLabel}](${s.url})`,
    "",
    s.about,
    "",
    `- Lists its own sources: **${WORDS[s.lists.level]}.** ${s.lists.note}`,
    `- Separates the record from hearsay: **${WORDS[s.record.level]}.** ${s.record.note}`,
    `- Treats magick as serious: **${WORDS[s.magick.level]}.** ${s.magick.note}`,
  ];
  if (s.caution) lines.push("", `> **Keep in mind:** ${s.caution}`);
  if (s.basis) lines.push("", `*${s.basis}*`);
  lines.push("");
  return lines.join("\n");
}

out.push("# Webliography", "");
out.push(
  `The sources behind Divination Station's explanations, in one place. Written from \`lib/sources.ts\` by \`scripts/export-webliography.ts\`; edit the data and run the script, not this file. Checked ${SOURCES_CHECKED_ON}.`,
  ""
);
out.push("The app also has a page on Dean Radin's psi research, its background and its critics, with its own sources: `/sources/radin` (data in `lib/radin-research.ts`).", "");

// The primary sources come first, in the owner's order. They are not graded against the three tests.
out.push("## Primary sources", "");
out.push(`The works the app's maker draws on most: the first four in the maker's order, then the books from the maker's shelf by subject (\`/sources/primary\`, data in \`lib/primary-sources.ts\`). They are not graded against the three tests below. Checked ${PRIMARY_CHECKED_ON}.`, "");
const primaryEntry = (s: PrimarySource, heading: string) => {
  out.push(`### ${heading}`, "", s.cite, "", `[${s.urlLabel}](${s.url})`, "", s.about, "");
  if (s.why) out.push(`**Why it is here:** ${s.why}`, "");
  if (s.page) out.push(`Full page in the app: \`${s.page}\`.`, "");
  for (const g of s.groups ?? []) {
    out.push(`#### ${g.title}`, "");
    if (g.intro) out.push(g.intro, "");
    for (const l of g.links) out.push(`- [${l.label}](${l.url})${l.note ? `: ${l.note}` : ""}`);
    out.push("");
  }
  if (s.caution) out.push(`> **Keep in mind:** ${s.caution}`, "");
  out.push(`*${s.basis}*`, "");
};
PRIMARY_SOURCES.forEach((s, i) => primaryEntry(s, `${i + 1}. ${s.name}: ${s.work}`));
out.push("## Secondary and tangential sources", "");
for (const s of SECONDARY_SOURCES) primaryEntry(s, `${s.name}: ${s.work}`);
out.push("## Things to check out", "", "Not sources for the app, but things its maker recommends.", "");
for (const l of CHECK_OUT) out.push(`- [${l.label}](${l.url})${l.note ? `: ${l.note}` : ""}`);
out.push("");
out.push("## How to read it", "");
out.push("A source is recommended when it does three things:", "");
out.push("1. It lists its own sources, so you can check it.");
out.push("2. It explains what is left in the historical record (objects, texts, inscriptions) and what is hearsay or guesswork.");
out.push("3. It treats magick and divination as a serious subject: something people did, and do.", "");
out.push(DEFAULT_BASIS, "");
out.push("A \"Read more\" marker in the app means a source treats the topic, not that a given page proves a given sentence. \"Not settled\" means the check could not tell. A tradition that is alive (the Tibetan Mo, for example) is not reproduced in the app; its own teachers and texts are the place to learn it.", "");

out.push("## Contents", "");
out.push("- [Primary sources](#primary-sources)");
out.push("- [Secondary and tangential sources](#secondary-and-tangential-sources)");
out.push("- [Things to check out](#things-to-check-out)");
for (const id of ORDER) out.push(`- [${title(id)}](#${slug(id)})`);
out.push("- [Tea leaves](#tool-tea)");
out.push("- [Every source, A to Z](#every-source-a-to-z)", "");

for (const id of ORDER) {
  const g = TOOL_GUIDES[id];
  out.push(`<a id="${slug(id)}"></a>`, "", `## ${title(id)}`, "");
  if (g.survives.length) {
    out.push("**What still exists**", "", ...g.survives.map((l) => `- ${l}`), "");
    out.push("**What is conjecture or later invention**", "", ...g.conjecture.map((l) => `- ${l}`), "");
  }
  if (g.gap) out.push(g.gap, "");
  const groups: [string, string[]][] = [
    ["Start here", g.start],
    ["The record itself", g.record.filter((r) => !g.start.includes(r))],
    ["Also worth reading", g.more.filter((r) => !g.start.includes(r))],
  ];
  for (const [label, ids] of groups) {
    const list = ids.map(getSource).filter((s): s is Source => !!s);
    if (list.length === 0) continue;
    out.push(`### ${label}`, "");
    for (const s of list) out.push(entry(s, id));
  }
}

// Tea leaves have no guide of their own (the reading is the app's design); these sources are behind its choice of teas.
out.push('<a id="tool-tea"></a>', "", "## Tea leaves", "");
out.push("Which tea to use for reading the leaves. The concepts the app puts beside each tea are its own suggestions, not part of any tradition.", "");
for (const s of (CITES["blots.tea"] ?? []).map(getSource).filter((s): s is Source => !!s)) out.push(entry(s, "across"));

out.push("## Every source, A to Z", "");
const sorted = [...SOURCES].sort((a, b) => a.short.localeCompare(b.short));
for (const s of sorted) out.push(`- [${s.short}](${s.url}): ${s.cite}`);
out.push("");

const target = path.join(__dirname, "..", "docs", "webliography.md");
fs.writeFileSync(target, out.join("\n"), "utf8");
console.log(`wrote ${target} (${SOURCES.length} sources)`);
