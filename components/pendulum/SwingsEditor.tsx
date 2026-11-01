"use client";

import { useId, useState } from "react";
import { parseDate, toISOString } from "@/lib/date";
import PendulumBoard from "@/components/pendulum/PendulumBoard";
import type { PendulumSwing } from "@/lib/pendulum";
import { LAST_ANGLE_EXACT, MAX_SWING_NAME_LENGTH, cleanAngle, formatAngle, lineSymbolId, swingName, swingWords } from "@/lib/pendulum-swings";
import CommonMeaningBlock from "@/components/CommonMeaningBlock";
import { COMMON_SOURCES, PENDULUM_MEANINGS, pendulumKey } from "@/lib/common-meanings-data";
import { buttonClass } from "@/components/ui/Button";
import { fieldFullClass } from "@/components/ui/Field";
import { SectionLabel } from "@/components/ui/Page";
import OwnLinks from "@/components/yours/OwnLinks";


function send(url: string, method: string, body?: unknown) {
  return fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** The message the server gave, or the one to use when it gave none. */
async function reasonOf(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null);
  return typeof body?.error === "string" ? body.error : fallback;
}

/** The starting swings first, then the added lines by angle: the same order the server uses. */
function inOrder(swings: PendulumSwing[]): PendulumSwing[] {
  return [...swings].sort(
    (a, b) =>
      b.builtin - a.builtin ||
      a.sort_order - b.sort_order ||
      (a.angle ?? 999) - (b.angle ?? 999) ||
      a.id - b.id
  );
}

interface RowProps {
  swing: PendulumSwing;
  /** True when this is the only swing in play, so it cannot be left out. */
  onlyOneInPlay: boolean;
  onChanged: (swing: PendulumSwing) => void;
  onRemoved: (id: number) => void;
}

/** One swing: its picture, whether it is in play, the person's own words for it, and the wordings it had before. */
function SwingRow({ swing, onlyOneInPlay, onChanged, onRemoved }: RowProps) {
  const uid = useId();
  const [meaning, setMeaning] = useState(swing.meaning ?? "");
  const [name, setName] = useState(swing.name ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [confirmWording, setConfirmWording] = useState<number | null>(null);

  const added = swing.builtin === 0;
  const dirty = meaning.trim() !== (swing.meaning ?? "") || (added && name.trim() !== (swing.name ?? ""));

  // Sends one change and takes the saved swing back. Returns whether it worked.
  async function change(body: unknown, failure: string): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const res = await send(`/api/pendulum/swings/${swing.id}`, "PATCH", body);
      if (!res.ok) throw new Error(await reasonOf(res, failure));
      onChanged(await res.json());
      return true;
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : failure);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const saved = await change(
      added ? { meaning, name } : { meaning },
      "Could not save. Your words are still here; try again."
    );
    if (saved) {
      setMeaning(meaning.trim());
      setName(name.trim());
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await send(`/api/pendulum/swings/${swing.id}`, "DELETE");
      if (!res.ok) throw new Error(await reasonOf(res, "Could not remove the swing. Nothing was removed."));
      onRemoved(swing.id);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Could not remove the swing. Nothing was removed.");
      setBusy(false);
    }
  }

  async function deleteWording(id: number) {
    setBusy(true);
    setError(null);
    try {
      const res = await send(`/api/pendulum/swings/${swing.id}/wordings/${id}`, "DELETE");
      if (!res.ok) throw new Error();
      onChanged(await res.json());
      setConfirmWording(null);
    } catch {
      setError("Could not delete that wording. Nothing was removed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="bg-surface border border-line rounded-card p-4 space-y-3">
      <div className="flex items-center gap-3">
        <PendulumBoard
          shape={swing.shape}
          angle={swing.angle}
          label={swingName(swing)}
          moving={false}
          className="w-14 h-14 flex-shrink-0"
        />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-ink-strong break-words">{swingName(swing)}</p>
          <p className="text-xs text-ink-faint">{swingWords(swing)}</p>
        </div>
        <label className="flex items-center gap-2 text-xs text-ink-muted cursor-pointer flex-shrink-0">
          <input
            type="checkbox"
            checked={swing.in_play === 1}
            disabled={busy || (swing.in_play === 1 && onlyOneInPlay)}
            onChange={(e) => change({ in_play: e.target.checked }, "Could not change that. Nothing was changed.")}
            className="accent-tone-600"
          />
          In play
        </label>
      </div>
      {swing.in_play === 0 && (
        <p className="text-[11px] text-ink-ghost">This swing is left out. It will not come up until you put it back in play.</p>
      )}

      <OwnLinks symbolId={pendulumKey(swing) ?? (swing.shape === "line" && swing.angle !== null ? lineSymbolId(swing.angle) : undefined)} />

      {added && (
        <p className="text-[11px] text-ink-faint leading-relaxed">
          A line you add has no shared archetypes, because no tradition gives an angle like this a meaning. The links you make above are the
          only ones it has.
        </p>
      )}

      {(() => {
        const key = pendulumKey(swing);
        const common = key ? PENDULUM_MEANINGS[key] : undefined;
        return common ? (
          <details className="text-sm">
            <summary className="cursor-pointer text-xs text-ink-faint hover:text-ink-soft">Common meaning (a starting point only)</summary>
            <div className="mt-2 bg-surface-sunken rounded-xl p-4 border border-line-faint">
              <CommonMeaningBlock meaning={common} source={COMMON_SOURCES.pendulum} symbolId={key ?? undefined} />
            </div>
          </details>
        ) : null;
      })()}

      <form onSubmit={save} className="space-y-2">
        {added && (
          <div>
            <label htmlFor={`${uid}-name`} className="block text-xs text-ink-faint mb-1">Name (optional)</label>
            <input
              id={`${uid}-name`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={MAX_SWING_NAME_LENGTH}
              autoComplete="off"
              className={fieldFullClass}
            />
          </div>
        )}
        <div>
          <label htmlFor={`${uid}-meaning`} className="block text-xs text-ink-faint mb-1">
            What this swing means to you
          </label>
          <textarea
            id={`${uid}-meaning`}
            value={meaning}
            onChange={(e) => setMeaning(e.target.value)}
            rows={2}
            className={`${fieldFullClass} resize-y leading-relaxed`}
          />
        </div>
        {dirty && (
          <div className="flex items-center gap-2">
            <button type="submit" disabled={busy} className={buttonClass.primary}>{busy ? "Saving…" : "Save"}</button>
            <button
              type="button"
              onClick={() => { setMeaning(swing.meaning ?? ""); setName(swing.name ?? ""); setError(null); }}
              className={buttonClass.quiet}
            >
              Cancel
            </button>
          </div>
        )}
      </form>

      {swing.earlier.length > 0 && (
        <details>
          <summary className="text-[11px] text-ink-faint hover:text-ink-soft cursor-pointer">
            Earlier wordings ({swing.earlier.length})
          </summary>
          <ul className="mt-2 space-y-3 list-none p-0 m-0">
            {swing.earlier.map((w) => (
              <li key={w.id} className="space-y-1 border-l-2 border-line-strong pl-3">
                <p className="text-[10px] text-ink-ghost">
                  Written{" "}
                  <time dateTime={toISOString(w.created_at)} suppressHydrationWarning>
                    {parseDate(w.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
                  </time>
                </p>
                <p className="text-sm text-ink-soft leading-relaxed whitespace-pre-wrap break-words">{w.content}</p>
                <button
                  onClick={async () => {
                    // Making an earlier wording the current one keeps the wording it replaces, like any other change.
                    if (await change({ meaning: w.content }, "Could not bring that wording back. Nothing was changed.")) {
                      setMeaning(w.content);
                    }
                  }}
                  disabled={busy}
                  className={`${buttonClass.text} mr-4`}
                >
                  Use this version
                </button>
                {confirmWording === w.id ? (
                  <p className="text-xs text-ink-muted">
                    Delete this earlier wording? This cannot be undone.{" "}
                    <button onClick={() => deleteWording(w.id)} disabled={busy} className="text-danger-ink hover:text-danger-soft">
                      Yes, delete
                    </button>{" "}
                    <button onClick={() => setConfirmWording(null)} className="text-ink-faint hover:text-ink-soft">Cancel</button>
                  </p>
                ) : (
                  <button onClick={() => setConfirmWording(w.id)} className={buttonClass.danger}>Delete this wording</button>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      {added && (
        <div>
          {confirmRemove ? (
            <p className="text-xs text-ink-muted leading-relaxed">
              Remove this swing and its earlier wordings? Answers it gave stay, with its name and your words as they
              were then. This cannot be undone.{" "}
              <button onClick={remove} disabled={busy} className="text-danger-ink hover:text-danger-soft">
                {busy ? "Removing…" : "Yes, remove"}
              </button>{" "}
              <button onClick={() => setConfirmRemove(false)} className="text-ink-faint hover:text-ink-soft">Cancel</button>
            </p>
          ) : (
            <button onClick={() => setConfirmRemove(true)} className={buttonClass.danger}>Remove this swing</button>
          )}
        </div>
      )}
      {error && <p className="text-xs text-danger" role="alert">{error}</p>}
    </li>
  );
}

/** How many swings the list shows at first, and how many more each press of "Show more" adds. */
const PAGE_OF_SWINGS = 60;

interface Props {
  initialSwings: PendulumSwing[];
  /** Whether to show the short explanations (the person's "Explanations" setting). */
  hints: boolean;
}

/** The person's swings: put them in or out of play, write what each means to them, and add lines at other angles. */
export default function SwingsEditor({ initialSwings, hints }: Props) {
  const uid = useId();
  const [swings, setSwings] = useState(() => inOrder(initialSwings));
  // A person with many swings sees the first of them and asks for more, so the page stays quick.
  const [visible, setVisible] = useState(PAGE_OF_SWINGS);
  const [angle, setAngle] = useState("");
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const inPlay = swings.filter((s) => s.in_play === 1).length;
  const typedAngle = angle.trim() === "" ? null : cleanAngle(Number(angle));

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (typedAngle === null || adding) return;
    setAdding(true);
    setAddError(null);
    try {
      const res = await send("/api/pendulum/swings", "POST", { angle: typedAngle, name: newName });
      if (!res.ok) throw new Error(await reasonOf(res, "Could not add the swing. Nothing was added."));
      const added: PendulumSwing = await res.json();
      setSwings((list) => inOrder([...list, added]));
      // The new swing may sit far down a long list; make sure it is among the ones shown.
      setVisible((v) => Math.max(v, swings.length + 1));
      setAngle("");
      setNewName("");
    } catch (err) {
      setAddError(err instanceof Error && err.message ? err.message : "Could not add the swing. Nothing was added.");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="space-y-8">
      <section aria-labelledby={`${uid}-swings`} className="space-y-3">
        <SectionLabel id={`${uid}-swings`}>
          Your swings ({swings.length}, {inPlay} in play)
        </SectionLabel>
        {hints && (
          <p className="text-xs text-ink-faint leading-relaxed">
            Write what each swing means to you. Nothing is written for you, and a swing with no words still comes up
            by its name. A swing that is not in play is never picked. When you change your words, the earlier ones
            are kept under the swing.
          </p>
        )}
        <ul className="space-y-3 list-none p-0 m-0">
          {swings.slice(0, visible).map((s) => (
            <SwingRow
              key={s.id}
              swing={s}
              onlyOneInPlay={inPlay === 1}
              onChanged={(updated) => setSwings((list) => inOrder(list.map((x) => (x.id === updated.id ? updated : x))))}
              onRemoved={(id) => setSwings((list) => list.filter((x) => x.id !== id))}
            />
          ))}
        </ul>
        {swings.length > visible && (
          <button onClick={() => setVisible((v) => v + PAGE_OF_SWINGS)} className={buttonClass.text}>
            Show {Math.min(PAGE_OF_SWINGS, swings.length - visible)} more ({swings.length - visible} not shown)
          </button>
        )}
      </section>

      <section aria-labelledby={`${uid}-add`} className="bg-surface border border-line rounded-card p-5 space-y-4">
        <SectionLabel id={`${uid}-add`}>Add a swing at an angle</SectionLabel>
        {hints && (
          <p className="text-xs text-ink-faint leading-relaxed">
            An added swing is a straight line at an angle you choose, from 0 to {LAST_ANGLE_EXACT} degrees in steps of a
            tenth, clockwise from straight up and down on the board. 0 is back and forth and 90 is side to side, and
            those two are already here. You can add more than one swing at the same angle: give each a name so you can
            tell them apart.
          </p>
        )}
        <form onSubmit={add} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="sm:w-32">
              <label htmlFor={`${uid}-angle`} className="block text-xs text-ink-faint mb-1">Angle, in degrees</label>
              <input
                id={`${uid}-angle`}
                type="number"
                inputMode="decimal"
                min={0}
                max={LAST_ANGLE_EXACT}
                step={0.1}
                value={angle}
                onChange={(e) => setAngle(e.target.value)}
                className={fieldFullClass}
              />
            </div>
            <div className="sm:flex-1">
              <label htmlFor={`${uid}-name`} className="block text-xs text-ink-faint mb-1">Name (optional)</label>
              <input
                id={`${uid}-name`}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={MAX_SWING_NAME_LENGTH}
                autoComplete="off"
                className={fieldFullClass}
              />
            </div>
          </div>
          {typedAngle !== null && (
            <div className="flex items-center gap-3">
              <PendulumBoard
                shape="line"
                angle={typedAngle}
                label={newName.trim() || `Line at ${formatAngle(typedAngle)}°`}
                moving={false}
                className="w-14 h-14 flex-shrink-0"
              />
              <p className="text-xs text-ink-faint">A line at {formatAngle(typedAngle)}°. This is how the swing will look.</p>
            </div>
          )}
          <button type="submit" disabled={adding || typedAngle === null} className={buttonClass.primary}>
            {adding ? "Adding…" : "Add this swing"}
          </button>
          {angle.trim() !== "" && typedAngle === null && (
            <p className="text-xs text-ink-faint">The angle is a number from 0 to {LAST_ANGLE_EXACT}, with at most one decimal place.</p>
          )}
          {addError && <p className="text-xs text-danger" role="alert">{addError}</p>}
        </form>
      </section>
    </div>
  );
}
