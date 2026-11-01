"use client";

import { useState, useEffect, useRef, Suspense, useId } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { TAROT_DECK } from "@/lib/cards";
import CardDisplay from "@/components/CardDisplay";
import ShuffleOverlay, { shuffleWait } from "@/components/ShuffleOverlay";
import { usePrefs } from "@/components/usePrefs";
import { PageTitle } from "@/components/ui/Page";
import { SigilMark } from "@/components/ui/AppSigil";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";

interface Position { name: string; description: string; color?: string | null; x?: number | null; y?: number | null; rotation?: number | null; }
/** One of the person's layouts (lib/layouts.ts), with each position's question shown as its meaning. */
interface Spread { id: number; name: string; description: string | null; question: string | null; positions: Position[]; }
interface DrawnCard { position: string; card_id: string; card_name: string; reversed: boolean; color?: string; x?: number; y?: number; rotation?: number; }

/** What a card keeps of its position: the colour the person chose and, for a board layout, where it sits. */
function placeOf(pos: Position): Pick<DrawnCard, "color" | "x" | "y" | "rotation"> {
  const placed = typeof pos.x === "number" && typeof pos.y === "number";
  return {
    color: pos.color ?? undefined,
    ...(placed ? { x: pos.x as number, y: pos.y as number, rotation: pos.rotation ?? 0 } : {}),
  };
}

function NewReadingForm() {
  const router = useRouter();
  const params = useSearchParams();
  const presetSpreadId = params.get("layout_id") ?? params.get("spread_id");
  // ?mode=manual: the user drew from their own physical deck and is recording those cards.
  const ownDeck = params.get("mode") === "manual";
  const prefs = usePrefs();
  const uid = useId();

  const [spreads, setSpreads] = useState<Spread[]>([]);
  const [layoutsLoaded, setLayoutsLoaded] = useState(false);
  const [selectedSpreadId, setSelectedSpreadId] = useState<string>(presetSpreadId ?? "");
  const [question, setQuestion] = useState("");
  // The context or intention the person brings to the reading; kept as the reading's notes.
  const [description, setDescription] = useState("");
  const [drawnCards, setDrawnCards] = useState<DrawnCard[]>([]);
  const [saving, setSaving] = useState(false);
  const [shuffling, setShuffling] = useState(false);
  const skipShuffle = useRef<() => void>(() => {});
  const [step, setStep] = useState<"setup" | "cards">("setup");

  useEffect(() => {
    fetch("/api/layouts")
      .then((r) => r.json())
      .then((list: { id: number; name: string; description: string | null; question: string | null; positions: { name: string; prompt: string | null; color: string | null; x: number | null; y: number | null; rotation: number | null }[] }[]) =>
        setSpreads(list.map((l) => ({ ...l, positions: l.positions.map((p) => ({ ...p, description: p.prompt ?? "" })) })))
      )
      .catch(() => {})
      .finally(() => setLayoutsLoaded(true));
  }, []);

  const selectedSpread = spreads.find((s) => s.id === Number(selectedSpreadId));
  const activePositions: Position[] = selectedSpread?.positions ?? [];

  const stepLabel = step === "setup" ? "Step 1 of 2: Choose a layout and your question" : "Step 2 of 2: Enter the cards you drew";

  async function autoDraw() {
    if (!activePositions.length) return;
    setSaving(true);
    setShuffling(true);

    // A person who asked for less motion gets no buzzing and no waiting for an animation that is not shown.
    const calm = typeof window !== "undefined" && (window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "less");

    // Haptic feedback: rapid shuffle pulses, then a longer draw pulse
    if (!calm && typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([40, 25, 40, 25, 40, 25, 40, 25, 40, 25, 100]);
    }

    // Run the draw fetch alongside a minimum animation timer in parallel ("I am ready" ends the timer early)
    const wait = shuffleWait(calm);
    skipShuffle.current = wait.skip;
    const [drawData] = await Promise.all([
      fetch("/api/draw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: activePositions.length }),
      }).then((r) => r.json()),
      wait.done,
    ]);

    const drawn: DrawnCard[] = activePositions.map((pos, i) => ({
      position: pos.name,
      card_id: drawData.cards[i].id,
      card_name: drawData.cards[i].name,
      reversed: drawData.reversed?.[i] ?? false,
      ...placeOf(pos),
    }));

    await saveReading(drawn);
  }

  function initManual() {
    setDrawnCards(
      activePositions.map((pos) => ({ position: pos.name, card_id: "", card_name: "", reversed: false, ...placeOf(pos) }))
    );
    setStep("cards");
  }

  function updateCard(i: number, field: keyof DrawnCard, value: string | boolean) {
    setDrawnCards((cards) =>
      cards.map((c, idx) => {
        if (idx !== i) return c;
        if (field === "card_id") {
          const card = TAROT_DECK.find((t) => t.id === value);
          return { ...c, card_id: value as string, card_name: card?.name ?? "" };
        }
        return { ...c, [field]: value };
      })
    );
  }

  async function saveReading(cards: DrawnCard[]) {
    setSaving(true);
    const res = await fetch("/api/readings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        layout_id: selectedSpread?.id ?? null,
        spread_name: selectedSpread?.name ?? "Custom",
        title: null,
        question: question.trim() || null,
        cards,
        notes: description.trim() || null,
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    });
    if (res.ok) {
      const reading = await res.json();
      router.push(`/readings/${reading.id}`);
    }
    setSaving(false);
  }

  const descriptionId = `${uid}-description`;
  const questionId = `${uid}-question`;
  const spreadSelectId = `${uid}-spread-select`;

  return (
    <div className="max-w-page mx-auto px-4 py-8 space-y-6">
      {shuffling && <ShuffleOverlay count={activePositions.length} onSkip={() => skipShuffle.current()} />}
      <div aria-live="polite" aria-atomic="true" className="sr-only">{stepLabel}</div>

      <PageTitle>
        {question || (ownDeck ? "Record a Reading From Your Own Deck" : "New Reading")}
      </PageTitle>
      {ownDeck && step === "setup" && (
        <p className="text-sm text-ink-muted -mt-3">
          Lay out your own cards first. Choose the layout you used, then enter each card you drew.
        </p>
      )}

      {step === "setup" && (
        <div className="space-y-5">
          <div className="bg-surface border border-line rounded-card p-5 space-y-4">
            <Field htmlFor={questionId} label="Your question">
              <Input
                id={questionId}
                value={question} onChange={(e) => setQuestion(e.target.value)}
                placeholder="What would you like to ask?"
                maxLength={2000}
              />
            </Field>

            <div>
              <label htmlFor={spreadSelectId} className="block text-xs text-ink-faint mb-1">Layout</label>
              <Select
                id={spreadSelectId}
                value={selectedSpreadId}
                aria-describedby={`${spreadSelectId}-hint`}
                onChange={(e) => {
                  setSelectedSpreadId(e.target.value);
                  // The layout's own starting question fills an empty box and never replaces what was written.
                  const chosen = spreads.find((l) => l.id === Number(e.target.value));
                  if (chosen?.question && !question.trim()) setQuestion(chosen.question);
                }}
              >
                <option value="">— Select a layout —</option>
                {spreads.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.positions.length} cards)</option>
                ))}
              </Select>
              <p id={`${spreadSelectId}-hint`} className="text-xs text-ink-ghost mt-1">
                {layoutsLoaded && !spreads.length ? "You have no layouts yet. " : "These are your layouts. "}
                <Link href="/layouts" className="text-accent-ink hover:text-accent-ink-hover underline underline-offset-2">Make or change one</Link>, with your own colours and, if you like, a board like the Celtic Cross.
              </p>
            </div>

            <Field htmlFor={descriptionId} label="Context or intention (optional)">
              <Textarea
                id={descriptionId}
                value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="What is going on, or what you hope this reading helps with"
                rows={3}
                maxLength={20000}
              />
            </Field>
          </div>

          {prefs.scaffolding === "more" && (
            <p className="text-xs text-ink-faint leading-relaxed">
              A <span className="text-ink-soft">spread</span> is a layout. Each place in it is a{" "}
              <span className="text-ink-soft">position</span> with its own question, such as &ldquo;past&rdquo; or
              &ldquo;what helps&rdquo;. A card that lands upside down is <span className="text-ink-soft">reversed</span>.
              You can let the app draw, or draw from your own deck and enter the cards.
            </p>
          )}

          {/* Says why the two buttons are off, so a screen reader hears more than "unavailable". */}
          {!saving && (!activePositions.length || activePositions.some((p) => !p.name)) && (
            <p id={`${uid}-why-off`} className="text-xs text-ink-muted">
              To draw, choose a layout above.
            </p>
          )}
          <div className={`flex gap-3 ${ownDeck ? "flex-row-reverse" : ""}`}>
            <button
              onClick={autoDraw}
              disabled={saving || !activePositions.length || activePositions.some((p) => !p.name)}
              aria-describedby={!saving && (!activePositions.length || activePositions.some((p) => !p.name)) ? `${uid}-why-off` : undefined}
              className={ownDeck
                ? "flex-1 border border-line-strong hover:border-line-hover text-tone-300 font-semibold py-3 rounded-lg transition-colors disabled:opacity-40"
                : "flex-1 bg-blush hover:bg-blush-soft disabled:opacity-40 text-canvas font-semibold py-3 rounded-lg transition-colors"}
            >
              {saving ? "Drawing…" : `Draw for me${activePositions.length > 0 ? ` (${activePositions.length} card${activePositions.length === 1 ? "" : "s"})` : ""}`}
            </button>
            <button
              onClick={initManual}
              disabled={saving || !activePositions.length || activePositions.some((p) => !p.name)}
              aria-describedby={!saving && (!activePositions.length || activePositions.some((p) => !p.name)) ? `${uid}-why-off` : undefined}
              className={ownDeck
                ? "flex-1 bg-blush hover:bg-blush-soft disabled:opacity-40 text-canvas font-semibold py-3 rounded-lg transition-colors"
                : "flex-1 border border-line-strong hover:border-line-hover text-tone-300 font-semibold py-3 rounded-lg transition-colors disabled:opacity-40"}
            >
              Enter cards from my own deck
            </button>
          </div>
        </div>
      )}

      {step === "cards" && (
        <div className="space-y-6">
          <p className="text-sm text-ink-muted">
            For each position, choose the card you drew and tick <span className="text-ink-strong">Reversed</span> if it came out upside down.
          </p>
          <ul className="flex flex-wrap gap-6 justify-center list-none p-0 m-0" aria-label="Cards to assign">
            {drawnCards.map((card, i) => (
              <li key={i} className="flex flex-col items-center gap-2">
                <CardDisplay card={card} />
                <div className="w-36 space-y-1 mt-1">
                  <label htmlFor={`${uid}-card-select-${i}`} className="sr-only">
                    Card for position: {card.position || `Position ${i + 1}`}
                  </label>
                  <select
                    id={`${uid}-card-select-${i}`}
                    value={card.card_id}
                    onChange={(e) => updateCard(i, "card_id", e.target.value)}
                    className="w-full bg-field border border-line-strong rounded px-2 py-1 text-xs text-ink-strong focus:border-focus"
                  >
                    <option value="">— Select card —</option>
                    <optgroup label="Major Arcana">
                      {TAROT_DECK.filter((c) => c.suit === "major").map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </optgroup>
                    {(["cups", "pentacles", "swords", "wands"] as const).map((suit) => (
                      <optgroup key={suit} label={suit.charAt(0).toUpperCase() + suit.slice(1)}>
                        {TAROT_DECK.filter((c) => c.suit === suit).map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <label className="flex items-center gap-1 text-xs text-ink-muted cursor-pointer">
                    <input
                      type="checkbox"
                      checked={card.reversed}
                      onChange={(e) => updateCard(i, "reversed", e.target.checked)}
                      className="accent-tone-600"
                    />
                    Reversed
                  </label>
                </div>
              </li>
            ))}
          </ul>

          <div className="flex gap-3">
            <button
              onClick={() => setStep("setup")}
              className="border border-line-strong text-ink-muted px-4 py-2 min-h-11 sm:min-h-0 rounded-lg text-sm hover:border-line-hover transition-colors"
            >
              ← Back
            </button>
            <button
              onClick={() => saveReading(drawnCards)}
              disabled={saving || drawnCards.some((c) => !c.card_id)}
              className="flex-1 bg-blush hover:bg-blush-soft disabled:opacity-40 text-canvas font-semibold py-2 rounded-lg text-sm transition-colors"
            >
              {saving ? "Saving…" : "Save Reading"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NewReadingPage() {
  return (
    <Suspense fallback={
      <div role="status" aria-label="Loading" className="min-h-dvh flex items-center justify-center">
        <div aria-hidden="true" className="text-tone-400 text-2xl animate-pulse"><SigilMark /></div>
      </div>
    }>
      <NewReadingForm />
    </Suspense>
  );
}
