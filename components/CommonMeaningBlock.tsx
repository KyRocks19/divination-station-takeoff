import type { CommonMeaning } from "@/lib/common-meanings-data";
import SymbolArchetypes from "@/components/SymbolArchetypes";
import ArchetypeChips from "@/components/ArchetypeChips";

interface Props {
  meaning: CommonMeaning;
  /** How old these words are and how sure we are (COMMON_SOURCES). */
  source: string;
  /** Extra plain lines shown first, for example where a die face sits on its die. */
  note?: string;
  /** The piece's id ("rune-fehu"). When given, the archetypes are looked up with what each link was drawn from. */
  symbolId?: string;
}

/**
 * One symbol's common meaning: what it can mean when it goes well and when it is hard, and the archetypes it shares
 * with other symbols and with tarot. Stock words behind a button; the person's own words come first elsewhere.
 */
export default function CommonMeaningBlock({ meaning, source, note, symbolId }: Props) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-strong">{meaning.keywords}</p>
      {note && <p className="text-xs text-ink-faint">{note}</p>}
      <div className="space-y-1">
        <p className="text-[10px] text-tone-400 uppercase tracking-widest">When it goes well</p>
        <p className="text-sm text-ink-soft leading-relaxed">{meaning.light}</p>
      </div>
      <div className="space-y-1">
        <p className="text-[10px] text-tone-400 uppercase tracking-widest">When it is hard</p>
        <p className="text-sm text-ink-soft leading-relaxed">{meaning.shadow}</p>
      </div>
      <div className="space-y-1.5">
        <p className="text-[10px] text-tone-400 uppercase tracking-widest">Shared archetypes</p>
        {symbolId ? <SymbolArchetypes symbolId={symbolId} slugs={meaning.archetypes} /> : <ArchetypeChips slugs={meaning.archetypes} />}
      </div>
      <p className="text-[11px] text-ink-faint leading-relaxed">{source}</p>
    </div>
  );
}
