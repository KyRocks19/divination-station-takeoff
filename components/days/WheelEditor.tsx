"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { ErrorNote } from "@/components/ui/Page";
import { EMPTY_WHEEL, MAX_FESTIVAL_NAME, MAX_OWN_FESTIVALS, festivalsFor, type WheelChoices } from "@/lib/calendar-core";
import type { Hemisphere } from "@/lib/sky";

const MONTHS = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(2024, i, 15)).toLocaleDateString(undefined, { month: "long", timeZone: "UTC" }));
const pad = (n: number) => String(n).padStart(2, "0");

/** A month and a day, as two choice lists. 29 February is allowed (it shows in leap years). */
function MonthDay({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const m = Number(value.slice(0, 2));
  const d = Number(value.slice(3));
  const max = new Date(Date.UTC(2024, m, 0)).getUTCDate();
  return (
    <span className="flex gap-1">
      <Select aria-label={`${label}: month`} value={m} onChange={(e) => onChange(`${pad(Number(e.target.value))}-${pad(Math.min(d, new Date(Date.UTC(2024, Number(e.target.value), 0)).getUTCDate()))}`)} className="w-auto min-w-36">
        {MONTHS.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
      </Select>
      <Select aria-label={`${label}: day`} value={d} onChange={(e) => onChange(`${pad(m)}-${pad(Number(e.target.value))}`)} className="w-auto min-w-18">
        {Array.from({ length: max }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
      </Select>
    </span>
  );
}

/**
 * Changing the festivals on the calendar: show or hide each of the usual eight, give one a name or date of the person's own, add days of their own
 * (a birthday, a death day, a local feast), or go back to the usual eight. Saved to the account (lib/calendar.ts).
 */
export default function WheelEditor({ choices, hemisphere, onSaved }: { choices: WheelChoices; hemisphere: Hemisphere; onSaved: (c: WheelChoices) => void }) {
  const uid = useId();
  const [draft, setDraft] = useState<WheelChoices>(choices);
  const [newName, setNewName] = useState("");
  const [newDate, setNewDate] = useState("10-31");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const list = festivalsFor(draft, hemisphere);
  const changed = JSON.stringify(draft) !== JSON.stringify(choices);

  const edit = (fn: (c: WheelChoices) => WheelChoices) => {
    setDraft(fn);
    setSaved(false);
  };

  async function save(next: WheelChoices) {
    setSaving(true);
    setError(null);
    setSaved(false);
    const res = await fetch("/api/calendar/wheel", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) }).catch(() => null);
    setSaving(false);
    if (!res?.ok) return setError((await res?.json().catch(() => null))?.error ?? "That could not be saved. Try again.");
    const back = (await res.json()) as WheelChoices;
    setDraft(back);
    onSaved(back);
    setSaved(true);
  }

  function addOwn() {
    const name = newName.replace(/\s+/g, " ").trim();
    if (!name) return setError("Give the day a name first.");
    setError(null);
    edit((c) => ({ ...c, own: [...c.own, { id: `own-${Date.now().toString(36)}`, name, date: newDate }] }));
    setNewName("");
  }

  return (
    <details className="rounded-card border border-line bg-surface p-4 group/wheel">
      <summary className="cursor-pointer min-h-11 sm:min-h-6 inline-flex items-center gap-2 text-sm text-ink-soft hover:text-ink-strong">
        <span aria-hidden="true">☸</span> Change the festivals on your calendar
      </summary>
      <div className="pt-4 space-y-4">
        <p className="text-xs text-ink-faint">
          The usual eight festivals of the Wheel of the Year are shown on their {hemisphere === "south" ? "southern" : "northern"} half of the world dates. You can
          change that in <Link href="/settings" className="underline">Settings</Link>. Show only the ones you keep, give them your own names and dates, or add days of
          your own. The solstices and equinoxes move by a day between some years.
        </p>

        <ul className="list-none p-0 space-y-2">
          {list.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center gap-2 rounded-control border border-line-faint p-2">
              {f.own ? (
                <span aria-hidden="true" className="text-blush w-11 text-center">✶</span>
              ) : (
                <label className="inline-flex items-center gap-1.5 min-h-11 sm:min-h-6 text-xs text-ink-faint w-20">
                  <input
                    type="checkbox"
                    checked={!f.hidden}
                    onChange={(e) => edit((c) => ({ ...c, hidden: e.target.checked ? c.hidden.filter((h) => h !== f.id) : [...c.hidden, f.id] }))}
                  />
                  Show<span className="sr-only"> {f.usualName ?? f.name}</span>
                </label>
              )}
              <span className="flex-1 min-w-40">
                <Input
                  aria-label={f.own ? `Name of your day on ${f.date}` : `Name for ${f.usualName ?? f.name}`}
                  value={f.name}
                  maxLength={MAX_FESTIVAL_NAME}
                  onChange={(e) =>
                    edit((c) =>
                      f.own
                        ? { ...c, own: c.own.map((o) => (o.id === f.id ? { ...o, name: e.target.value } : o)) }
                        : { ...c, names: { ...c.names, [f.id]: e.target.value } }
                    )
                  }
                />
              </span>
              <MonthDay
                label={f.usualName ?? f.name}
                value={f.date}
                onChange={(v) => edit((c) => (f.own ? { ...c, own: c.own.map((o) => (o.id === f.id ? { ...o, date: v } : o)) } : { ...c, dates: { ...c.dates, [f.id]: v } }))}
              />
              {f.own ? (
                <Button variant="danger" className="min-h-6" onClick={() => edit((c) => ({ ...c, own: c.own.filter((o) => o.id !== f.id) }))} aria-label={`Remove ${f.name}`}>
                  Remove
                </Button>
              ) : (
                (f.usualName || f.usualDate) && (
                  <Button
                    variant="text"
                    className="min-h-6"
                    onClick={() =>
                      edit((c) => {
                        const names = { ...c.names };
                        const dates = { ...c.dates };
                        delete names[f.id];
                        delete dates[f.id];
                        return { ...c, names, dates };
                      })
                    }
                  >
                    Usual name and date
                  </Button>
                )
              )}
            </li>
          ))}
        </ul>

        {draft.own.length < MAX_OWN_FESTIVALS && (
          <div className="flex flex-wrap items-end gap-2">
            <span className="flex-1 min-w-40 space-y-1">
              <label htmlFor={`${uid}-name`} className="block text-xs text-ink-faint">Add a day of your own</label>
              <Input id={`${uid}-name`} value={newName} maxLength={MAX_FESTIVAL_NAME} onChange={(e) => setNewName(e.target.value)} placeholder="For example, a birthday or a local feast" />
            </span>
            <MonthDay label="Your new day" value={newDate} onChange={setNewDate} />
            <Button variant="purple" onClick={addOwn}>Add</Button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button disabled={saving || !changed} onClick={() => save(draft)}>{saving ? "Saving…" : "Save festivals"}</Button>
          <Button variant="quiet" disabled={saving} onClick={() => save(EMPTY_WHEEL)}>Go back to the usual eight</Button>
          {saved && <span role="status" className="text-xs text-success">Saved</span>}
        </div>
        {error && <ErrorNote>{error}</ErrorNote>}
      </div>
    </details>
  );
}
