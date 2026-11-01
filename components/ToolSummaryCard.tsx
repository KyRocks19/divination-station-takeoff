import SuitRing from "@/components/SuitRing";
import ToolGlyph from "@/components/ui/ToolGlyph";
import Styled from "@/components/ui/Styled";
import { DIVINATION_KIND_LABELS } from "@/lib/divination-kinds";
import { ringLabel, type ToolSummary } from "@/lib/tool-summary-core";

/**
 * One tool's summary: a ring and a list of how what came up is spread over the tool's groups (for tarot, the suits and the Major Arcana), and
 * what keeps coming up. The same shape for every tool (open item PAT1). Counts only; it says what is there, never what it means.
 */
export default function ToolSummaryCard({ summary, headingLevel = 3 }: { summary: ToolSummary; headingLevel?: 2 | 3 }) {
  const { kind, groups, recurring } = summary;
  const total = groups.reduce((n, g) => n + g.count, 0);
  const Heading = `h${headingLevel}` as "h2" | "h3";
  const meta = Object.fromEntries(groups.map((g) => [g.id, { label: g.label, color: g.color }]));
  return (
    <section aria-label={`${DIVINATION_KIND_LABELS[kind]} summary`} className="bg-surface border border-line rounded-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <ToolGlyph kind={kind} className="h-5 w-5 text-tone-300" />
        <Heading className="text-sm font-medium text-ink-strong">{DIVINATION_KIND_LABELS[kind]}</Heading>
        <span className="text-xs text-ink-faint">
          {summary.readings} reading{summary.readings === 1 ? "" : "s"}
          {total > 0 ? `, ${total} ${total === 1 ? summary.unit : summary.noun} counted` : ""}
        </span>
      </div>

      {total > 0 ? (
        <div className="flex flex-col sm:flex-row gap-6 items-center">
          <div className="flex-shrink-0">
            <SuitRing
              distribution={groups.map((g) => ({ suit: g.id, count: g.count, percentage: g.percentage }))}
              meta={meta}
              unit={summary.unit}
              label={ringLabel(kind)}
              size={110}
            />
          </div>

          <div className="flex-1 w-full space-y-1.5">
            <p className="text-[10px] text-ink-ghost uppercase tracking-widest">{summary.groupTitle}</p>
            {groups.map((g) => (
              <div key={g.id} className="flex items-center gap-2">
                <Styled as="span" className="w-2 h-2 rounded-full flex-shrink-0" css={{ background: g.color }} />
                <span className="text-xs text-ink-faint w-40 sm:w-48 flex-shrink-0 break-words">{g.label}</span>
                <div className="h-1 rounded-full flex-1 bg-line overflow-hidden" aria-hidden="true">
                  <Styled className="h-full rounded-full w-0" css={{ width: `${Math.round(g.percentage)}%`, background: g.color }} />
                </div>
                <span className="text-xs text-ink-ghost w-9 text-right">{Math.round(g.percentage)}%</span>
              </div>
            ))}
          </div>

          {recurring.length > 0 && (
            <div className="flex-shrink-0 flex flex-col gap-2">
              <p className="text-[10px] text-ink-ghost uppercase tracking-widest">Recurring</p>
              {recurring.map((r) => (
                <div key={r.name} className="flex items-center gap-2">
                  <span className="text-xs text-ink-soft truncate max-w-[130px]">{r.name}</span>
                  <span className="text-[10px] text-tone-500">×{r.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-ink-ghost">Nothing has been counted for this tool yet.</p>
      )}
    </section>
  );
}
