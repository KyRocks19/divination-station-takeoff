"use client";

import { useId, useState } from "react";
import ItemArt from "@/components/oracle/ItemArt";
import { formWords, type SetForm } from "@/lib/oracle-forms";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { parseDate, toISOString } from "@/lib/date";
import SkyLine from "@/components/SkyLine";
import DivinationJournal from "@/components/DivinationJournal";
import PredictionsPanel from "@/components/PredictionsPanel";
import CompanionPanel from "@/components/CompanionPanel";
import DivinationTags from "@/components/DivinationTags";
import GuessFirst from "@/components/GuessFirst";
import Reveal from "@/components/reveal/Reveal";
import { revealSpec } from "@/lib/reveal-core";
import { useGuess } from "@/components/useGuess";
import GuidePanel from "@/components/GuidePanel";
import { ShareToolReading } from "@/components/ShareReading";
import InterviewPanel from "@/components/InterviewPanel";
import AddToDay from "@/components/AddToDay";
import { usePrefs } from "@/components/usePrefs";
import type { Sky } from "@/lib/sky";
import type { DivinationEntry } from "@/lib/divinations";
import type { OracleCard, OracleCardPull, OraclePull, OraclePullCard } from "@/lib/oracle";
import { buttonClass } from "@/components/ui/Button";
import { fieldFullClass } from "@/components/ui/Field";
import { BackLink, Page } from "@/components/ui/Page";


function UpsideDown() {
  return (
    <span className="text-[10px] text-danger-soft border border-danger/40 rounded px-1.5 py-0.5 uppercase tracking-wide">
      Upside down
    </span>
  );
}

interface PulledCardProps {
  card: OraclePullCard;
  /** The pull this card came up in (the id of its shared record). */
  pullId: number;
  /** Whether the person has already written what they noticed first on this pull. */
  hasImpression: boolean;
  hints: boolean;
  /** The form of the set the pull was made from, for the words and the shape. */
  form: SetForm;
  /** Called after a first impression is saved, so the writing list can load it. */
  onWrote: () => void;
}

/**
 * One card that came up. The person's earlier words about it stay closed until they have written what they
 * notice today, or until they ask to see them, so today's reading of the card comes first.
 */
function PulledCard({ card, pullId, hasImpression, hints, form, onWrote }: PulledCardProps) {
  const w = formWords(form);
  const noticeId = useId();
  const [words, setWords] = useState<OracleCard | null>(null);
  const [earlier, setEarlier] = useState<OracleCardPull[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [gone, setGone] = useState(card.card_id === null);
  const [failed, setFailed] = useState(false);
  const [notice, setNotice] = useState("");
  const [wrote, setWrote] = useState(hasImpression);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  // While "write what you sense first" is on, its one card for the whole pull replaces the notice box below, and what the person wrote before stays closed until it is done.
  const guess = useGuess(pullId);
  const sharedStep = !guess.state.loaded || guess.state.stepOn;

  async function show() {
    if (words) { setOpen(true); return; }
    setLoading(true);
    setFailed(false);
    try {
      const [cardRes, pullsRes] = await Promise.all([
        fetch(`/api/oracle/cards/${card.card_id}`),
        fetch(`/api/oracle/cards/${card.card_id}/pulls?except=${pullId}`),
      ]);
      if (cardRes.status === 404) { setGone(true); return; }
      if (!cardRes.ok) throw new Error();
      setWords(await cardRes.json());
      setEarlier(pullsRes.ok ? await pullsRes.json() : []);
      setOpen(true);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  // Saves what the person notices today as a first impression, then opens their earlier words.
  async function saveNotice(e: React.FormEvent) {
    e.preventDefault();
    if (!notice.trim() || saving) return;
    setSaving(true);
    setSaveFailed(false);
    try {
      const res = await fetch(`/api/divinations/${pullId}/journals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: notice, kind: "impression" }),
      });
      if (!res.ok) throw new Error();
      setWrote(true);
      setNotice("");
      onWrote();
      await show();
    } catch {
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  }

  // When the card landed upside down, the meanings written for that come first; otherwise they come last.
  const meanings = words
    ? [...words.meanings].sort((a, b) => (card.reversed ? b.reversed - a.reversed : a.reversed - b.reversed))
    : [];
  const earlierWithWords = earlier.filter((p) => p.question || p.entries.length > 0);

  return (
    <section className="bg-surface border border-line rounded-xl p-6 space-y-4">
      <div className="space-y-2 text-center">
        {card.position_name && (
          <p className="text-xs text-tone-400 uppercase tracking-widest break-words">{card.position_name}</p>
        )}
        <ItemArt cardId={card.card_id} version={card.art_version} alt={card.art_alt} form={form} height={card.art_version ? 140 : 64} className="mx-auto" />
        <p className="text-2xl font-bold text-tone-100 break-words">{card.card_name}</p>
        {card.reversed === 1 && <UpsideDown />}
        {card.position_prompt && (
          <p className="text-sm text-ink-muted italic leading-relaxed break-words">{card.position_prompt}</p>
        )}
      </div>

      {gone ? (
        <p className="text-xs text-ink-faint text-center">This {w.one} has since been deleted. Its name is kept here.</p>
      ) : !open ? (
        <div className="space-y-3">
          {!wrote && !sharedStep && (
            <form onSubmit={saveNotice} className="space-y-2">
              <label htmlFor={noticeId} className="block text-xs text-tone-300 uppercase tracking-widest">
                What do you notice today?
              </label>
              <textarea
                id={noticeId}
                value={notice}
                onChange={(e) => setNotice(e.target.value)}
                rows={3}
                className={`${fieldFullClass} resize-y leading-relaxed`}
              />
              {hints && (
                <p className="text-[11px] text-ink-ghost leading-relaxed">
                  Write this before you open what you wrote on the {w.one} before. Then you can read the two side by
                  side. You can also skip it.
                </p>
              )}
              <button type="submit" disabled={saving || !notice.trim()} className={buttonClass.primary}>
                {saving ? "Saving…" : "Save, then show what I wrote before"}
              </button>
              {saveFailed && (
                <p className="text-xs text-danger" role="alert">Could not save. Your text is still here; try again.</p>
              )}
            </form>
          )}
          {!guess.held && (
            <div className={wrote || sharedStep ? "text-center" : ""}>
              <button onClick={show} disabled={loading} className={buttonClass.text}>
                {loading ? "Loading…" : `Show what you wrote on this ${w.one}`}
              </button>
            </div>
          )}
        </div>
      ) : words && (
        <div className="border-t border-line pt-4 space-y-4">
          {words.origin && (
            <div className="space-y-1">
              <p className="text-[10px] text-ink-faint uppercase tracking-widest">Where it comes from</p>
              <p className="text-sm text-ink-strong leading-relaxed whitespace-pre-wrap break-words">{words.origin}</p>
            </div>
          )}
          {meanings.map((m) => (
            <div key={m.id} className="space-y-1 border-l-2 border-line-hover pl-3">
              {(m.label || m.reversed === 1) && (
                <p className="flex flex-wrap items-center gap-2">
                  {m.label && <span className="text-xs font-medium text-tone-300 break-words">{m.label}</span>}
                  {m.reversed === 1 && <UpsideDown />}
                </p>
              )}
              <p className="text-sm text-ink-strong leading-relaxed whitespace-pre-wrap break-words">{m.content}</p>
            </div>
          ))}
          {!words.origin && meanings.length === 0 && (
            <p className="text-sm text-ink-ghost italic">Nothing is written on this {w.one}.</p>
          )}

          {earlierWithWords.length > 0 && (
            <div className="space-y-3 pt-1">
              <p className="text-[10px] text-ink-faint uppercase tracking-widest">
                What you wrote when this {w.one} came up before
              </p>
              {earlierWithWords.map((p) => (
                <div key={p.id} className="space-y-1 border-l-2 border-line-strong pl-3">
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-ink-ghost">
                    <Link href={`/oracle/pulls/${p.id}`} className="text-tone-500 hover:text-tone-300 transition-colors">
                      <time dateTime={toISOString(p.created_at)} suppressHydrationWarning>
                        {parseDate(p.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
                      </time>
                    </Link>
                    {p.reversed === 1 && <UpsideDown />}
                  </p>
                  {p.question && <p className="text-xs text-ink-faint italic break-words">{p.question}</p>}
                  {p.entries.map((entry) => (
                    <p key={entry.id} className="text-sm text-ink-soft leading-relaxed whitespace-pre-wrap break-words">
                      {entry.content}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <Link href={`/oracle/cards/${words.id}`} className={buttonClass.text}>Open this {w.one}</Link>
            <button onClick={() => setOpen(false)} className="text-xs text-ink-faint hover:text-ink-soft transition-colors">
              Hide
            </button>
          </div>
        </div>
      )}
      {failed && <p className="text-xs text-danger text-center" role="alert">Could not load the {w.one}. Try again.</p>}
    </section>
  );
}

interface Props {
  initialPull: OraclePull;
  /** What the person has written about this pull so far. */
  initialEntries: DivinationEntry[];
  /** The sky recorded with the pull. */
  sky: Sky & { recorded: boolean };
}

/** One saved pull: when it was made, the question, the card that came up, and what the person wrote about it. */
export default function PullView({ initialPull, initialEntries, sky }: Props) {
  const router = useRouter();
  const questionId = useId();
  const hints = usePrefs().scaffolding === "more";
  const api = `/api/oracle/pulls/${initialPull.id}`;

  const [pull, setPull] = useState(initialPull);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialPull.question ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Goes up by one each time a first impression is saved, so "Your writing" loads it.
  const [journalSignal, setJournalSignal] = useState(0);

  const deckHref = pull.deck_id ? `/oracle?deck=${pull.deck_id}` : "/oracle";

  async function saveQuestion(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(api, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: draft }),
      });
      if (!res.ok) throw new Error();
      setPull(await res.json());
      setEditing(false);
    } catch {
      setError("Could not save. Your text is still here; try again.");
    } finally {
      setBusy(false);
    }
  }

  async function deletePull() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(api, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.push(deckHref);
    } catch {
      setError("Could not delete the pull. Nothing was removed.");
      setBusy(false);
    }
  }

  return (
    <Page>
      <BackLink href={deckHref}>
        ← {pull.deck_name}
      </BackLink>

      <header className="space-y-2">
        <h1 className="text-sm text-ink-faint uppercase tracking-widest">
          Pulled{" "}
          <time dateTime={toISOString(pull.created_at)} suppressHydrationWarning>
            {parseDate(pull.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
          </time>
        </h1>
        <SkyLine sky={sky} />
        {pull.layout_name && <p className="text-xs text-ink-faint break-words">Layout: {pull.layout_name}</p>}
      </header>

      <section aria-label="Your question or intention">
        {editing ? (
          <form onSubmit={saveQuestion} className="space-y-3">
            <label htmlFor={questionId} className="block text-xs text-ink-faint">Your question or intention</label>
            <textarea
              id={questionId}
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              className={`${fieldFullClass} resize-y leading-relaxed`}
            />
            <div className="flex items-center gap-2">
              <button type="submit" disabled={busy} className={buttonClass.primary}>{busy ? "Saving…" : "Save"}</button>
              <button
                type="button"
                onClick={() => { setDraft(pull.question ?? ""); setEditing(false); setError(null); }}
                className={buttonClass.quiet}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : pull.question ? (
          <div className="space-y-1">
            <p className="text-base text-ink-strong leading-relaxed whitespace-pre-wrap break-words">{pull.question}</p>
            <button onClick={() => setEditing(true)} className={buttonClass.text}>Edit</button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className={buttonClass.text}>Add a question or intention</button>
        )}
      </section>

      <GuessFirst divinationId={pull.id} />

      <Reveal divinationId={pull.id} question={pull.question} readingKey={`d${pull.id}`} createdAt={pull.created_at} spec={revealSpec("oracle")}>
        {pull.cards.map((c) => (
          <PulledCard
            key={c.id}
            card={c}
            pullId={pull.id}
            hasImpression={initialEntries.some((entry) => entry.kind === "impression")}
            hints={hints}
            form={pull.deck_form}
            onWrote={() => setJournalSignal((n) => n + 1)}
          />
        ))}
      </Reveal>

      <DivinationTags divinationId={pull.id} />

      <DivinationJournal
        divinationId={pull.id}
        initialEntries={initialEntries}
        noun="pull"
        cardMaker={{ deckId: pull.deck_id, form: pull.deck_form }}
        hints={hints}
        reloadSignal={journalSignal}
      />

      <ShareToolReading
        reading={{ tool: "Oracle Deck", question: pull.question ?? "", created_at: pull.created_at, lines: pull.cards.map((c) => `${c.position_name ? c.position_name + ": " : ""}${c.card_name}${c.reversed ? " (upside down)" : ""} (${pull.deck_name})`) }}
        entries={initialEntries.map((e) => ({ id: e.id, label: "You", content: e.content, when: parseDate(e.created_at).toLocaleDateString() }))}
      />

      <PredictionsPanel divinationId={pull.id} />

      <div className="mt-4"><AddToDay kind="reading" refId={pull.id} /></div>
      <CompanionPanel divinationId={pull.id} />
      <div className="mt-4"><InterviewPanel divinationId={pull.id} /></div>
      <div className="mt-4"><GuidePanel divinationId={pull.id} /></div>

      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {pull.deck_id && (
          <Link href={`/oracle/pulls/new?deck=${pull.deck_id}`} className={buttonClass.text}>Pull another {formWords(pull.deck_form).one}</Link>
        )}
        <Link href={pull.deck_id ? `/oracle/pulls?deck=${pull.deck_id}` : "/oracle/pulls"} className={buttonClass.text}>
          Past pulls
        </Link>
      </div>

      <div className="border-t border-line-faint pt-4">
        {confirmDelete ? (
          <p className="text-xs text-ink-muted leading-relaxed">
            Delete this pull and what you wrote about it? The {formWords(pull.deck_form).one} itself is not touched. This cannot be undone.{" "}
            <button onClick={deletePull} disabled={busy} className="text-danger-ink hover:text-danger-soft">
              {busy ? "Deleting…" : "Yes, delete"}
            </button>{" "}
            <button onClick={() => setConfirmDelete(false)} className="text-ink-faint hover:text-ink-soft">
              Cancel
            </button>
          </p>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className={buttonClass.danger}>Delete this pull</button>
        )}
        {error && <p className="text-xs text-danger mt-2" role="alert">{error}</p>}
      </div>
    </Page>
  );
}
