import { queryOne } from "./db";
import { readSnapshot } from "./forum-snapshots";

/**
 * What a forum post shows for one attachment. A reading, journal entry or synthesis posted since open item S7 is shown as it was
 * when posted (the post keeps a copy). A post made before that has no copy for a journal or synthesis, so it reads the original,
 * which is why editing one of those older entries still changes the post.
 */
export async function hydrateAttachment(att: { type: string; ref_id: number; snapshot: string | null }) {
  if (att.type === "reading") {
    if (att.snapshot) {
      return { type: "reading", ref_id: att.ref_id, data: JSON.parse(att.snapshot) };
    }
    const r = await queryOne("SELECT spread_name, cards FROM readings WHERE id = $1", [att.ref_id]) as any;
    if (!r) return null;
    return { type: "reading", ref_id: att.ref_id, data: { spread_name: r.spread_name, cards: JSON.parse(r.cards) } };
  }
  if (att.type === "journal" || att.type === "synthesis_journal") {
    const frozen = readSnapshot(att.snapshot);
    if (frozen) return { type: att.type, ref_id: att.ref_id, data: frozen };
  }
  if (att.type === "journal") {
    const j = await queryOne("SELECT * FROM journals WHERE id = $1", [att.ref_id]) as any;
    if (!j) return null;
    const reading = await queryOne("SELECT id, title, spread_name FROM readings WHERE id = $1", [j.reading_id]) as any;
    return { type: "journal", ref_id: att.ref_id, data: { ...j, reading } };
  }
  if (att.type === "synthesis_journal") {
    const sj = await queryOne("SELECT * FROM synthesis_journals WHERE id = $1", [att.ref_id]);
    return sj ? { type: "synthesis_journal", ref_id: att.ref_id, data: sj } : null;
  }
  return null;
}
