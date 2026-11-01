"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Field";
import ClothPicture from "@/components/cloth/ClothPicture";
import { FACING_LABELS, landing, landingWords, type Facing, type PlacementInput, type Zone } from "@/lib/cloth-core";

interface Item {
  index: number;
  label: string;
}
interface RecordedRow {
  item_index: number;
  item_label: string;
  where_kind: "zone" | "none" | "off";
  zone_name: string | null;
  x: number | null;
  y: number | null;
  facing: Facing | null;
  simulated: boolean;
}
interface Recorded {
  cloth_id: number | null;
  cloth_name: string;
  rows: RecordedRow[];
}
interface Loaded {
  kind: string;
  has_facing: boolean;
  items: Item[];
  recorded: Recorded | null;
}
interface ClothOption {
  id: number;
  name: string;
}
/** What the boxes hold for one item. `where` "" means not recorded. */
interface Row {
  where: "" | "zone" | "none" | "off";
  zone: string;
  x: number | null;
  y: number | null;
  facing: "" | Facing;
  simulated: boolean;
}

const NONE = "__none__";
const OFF = "__off__";

const emptyRow = (): Row => ({ where: "", zone: "", x: null, y: null, facing: "", simulated: false });

/**
 * "Where they landed" for a reading made with runes, ogham staves, dice, coins, oracle items, tarot cards, playing cards or charms: the person says which zone of a cloth each item landed
 * in (a list for each item, or a tap on the picture), or lets the app throw the items onto the cloth. The lists are the real controls; the picture is
 * an extra. Nothing is sent anywhere but the app's own server, and the app says nothing about what a zone means.
 */
export default function CastRecord({ divinationId }: { divinationId: number }) {
  const uid = useId();
  const api = `/api/divinations/${divinationId}/cloth`;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [cloths, setCloths] = useState<ClothOption[]>([]);
  const [clothId, setClothId] = useState<number | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [tapItem, setTapItem] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [recorded, setRecorded] = useState<Recorded | null>(null);

  function fillFrom(items: Item[], rec: Recorded | null) {
    const base = items.map(emptyRow);
    for (const r of rec?.rows ?? []) {
      if (r.item_index < base.length) base[r.item_index] = { where: r.where_kind, zone: r.zone_name ?? "", x: r.x, y: r.y, facing: r.facing ?? "", simulated: r.simulated };
    }
    setRows(base);
  }

  useEffect(() => {
    if (loaded) return;
    let live = true;
    (async () => {
      try {
        const [a, b] = await Promise.all([fetch(api), fetch("/api/cloths")]);
        if (!a.ok) throw new Error();
        const data: Loaded = await a.json();
        const list: ClothOption[] = b.ok ? await b.json() : [];
        if (!live) return;
        setLoaded(data);
        setCloths(list);
        setRecorded(data.recorded);
        fillFrom(data.items, data.recorded);
        if (data.recorded?.cloth_id) setClothId(data.recorded.cloth_id);
        else if (list.length === 1) setClothId(list[0].id);
      } catch {
        if (live) setMessage({ ok: false, text: "Could not load this. Reload the page to try again." });
      }
    })();
    return () => {
      live = false;
    };
  }, [loaded, api]);

  // The zones of the chosen cloth.
  useEffect(() => {
    if (!clothId) {
      setZones([]);
      return;
    }
    let live = true;
    fetch(`/api/cloths/${clothId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => {
        if (live && c) setZones(c.zones as Zone[]);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [clothId]);

  const items = loaded?.items ?? [];
  const setRow = (i: number, patch: Partial<Row>) => {
    setRows((list) => list.map((r, k) => (k === i ? { ...r, ...patch, simulated: false } : r)));
    setMessage(null);
  };

  /** The value of an item's "where" list: a zone's name, or one of two fixed words, or nothing. */
  const choiceOf = (r: Row) => (r.where === "zone" ? r.zone : r.where === "none" ? NONE : r.where === "off" ? OFF : "");
  function choose(i: number, value: string) {
    if (value === "") setRow(i, { where: "", zone: "", x: null, y: null });
    else if (value === NONE) setRow(i, { where: "none", zone: "", x: null, y: null });
    else if (value === OFF) setRow(i, { where: "off", zone: "", x: null, y: null });
    else setRow(i, { where: "zone", zone: value, x: null, y: null });
  }

  // A tap on the picture: the place becomes the item's place and its zone follows from it.
  function tap(x: number, y: number) {
    const l = landing(zones, x, y);
    setRow(tapItem, l.kind === "zone" ? { where: "zone", zone: l.zone.name, x, y } : { where: l.kind, zone: "", x, y });
  }

  const marks = rows.flatMap((r, i) => (r.x !== null && r.y !== null ? [{ x: r.x, y: r.y, text: String(i + 1) }] : []));

  async function save() {
    if (!clothId) return;
    const placements: PlacementInput[] = rows.flatMap((r, i) =>
      r.where === "" ? [] : [{ index: i, where: r.where, zone: r.where === "zone" ? r.zone : null, x: r.x, y: r.y, facing: r.facing === "" ? null : r.facing, simulated: false }]
    );
    await send("PUT", { cloth_id: clothId, placements }, "Saved where they landed.");
  }

  async function send(method: "PUT" | "POST", body: unknown, ok: string) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(api, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const b = await res.json().catch(() => null);
      if (!res.ok) throw new Error(typeof b?.error === "string" ? b.error : "That could not be saved.");
      setRecorded(b.recorded);
      fillFrom(items, b.recorded);
      setMessage({ ok: true, text: ok });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "That could not be saved. What you chose is still here; try again." });
    } finally {
      setBusy(false);
    }
  }

  async function forget() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(api, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setRecorded(null);
      fillFrom(items, null);
      setMessage({ ok: true, text: "Forgot where they landed." });
    } catch {
      setMessage({ ok: false, text: "Could not forget it. Nothing was changed." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card pad="sm">
      <section aria-labelledby={`${uid}-heading`}>
        <h2 id={`${uid}-heading`} className="text-xs text-ink-faint uppercase tracking-widest">Where they landed</h2>
        <div className="space-y-3 mt-3">
          {!loaded ? (
            <p role="status" className="text-xs text-ink-faint">{message?.text ?? "Loading…"}</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-ink-ghost">This reading has no items to place.</p>
          ) : (
            <>
              <p className="text-xs text-ink-faint">
                If you threw these onto a cloth, say where each one landed. Or let the app throw them for you. The app only counts: it does not say what a zone means.
              </p>
              {cloths.length === 0 ? (
                <p className="text-sm text-ink-muted">
                  You have no cloth yet. <Link href="/lots/cloths/new" className="underline text-accent-ink hover:text-accent-ink-hover">Make a cloth</Link> first, then come back.
                </p>
              ) : (
                <>
                  <div className="max-w-sm">
                    <label htmlFor={`${uid}-cloth`} className="block text-xs text-ink-faint mb-1">Cloth</label>
                    <Select id={`${uid}-cloth`} value={clothId ?? ""} onChange={(e) => { setClothId(e.target.value ? Number(e.target.value) : null); setMessage(null); }}>
                      <option value="">Choose a cloth</option>
                      {cloths.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </Select>
                  </div>

                  {clothId && (
                    <>
                      <ol className="list-none p-0 space-y-3">
                        {items.map((it, i) => {
                          const r = rows[i] ?? emptyRow();
                          const l = r.x !== null && r.y !== null ? landing(zones, r.x, r.y) : null;
                          return (
                            <li key={it.index} className="space-y-2 border border-line rounded-control p-3">
                              <p className="text-sm text-ink-strong break-words">{i + 1}. {it.label}</p>
                              <div className="grid gap-2 sm:grid-cols-2">
                                <div>
                                  <label htmlFor={`${uid}-w-${i}`} className="block text-xs text-ink-faint mb-1">Where it landed</label>
                                  <Select id={`${uid}-w-${i}`} value={choiceOf(r)} onChange={(e) => choose(i, e.target.value)}>
                                    <option value="">Not recorded</option>
                                    {zones.map((z) => <option key={z.name} value={z.name}>{z.name}</option>)}
                                    <option value={NONE}>On the cloth, in no zone</option>
                                    <option value={OFF}>Off the cloth</option>
                                  </Select>
                                </div>
                                {loaded.has_facing && (
                                  <div>
                                    <label htmlFor={`${uid}-f-${i}`} className="block text-xs text-ink-faint mb-1">How it lay</label>
                                    <Select id={`${uid}-f-${i}`} value={r.facing} onChange={(e) => setRow(i, { facing: e.target.value as "" | Facing })}>
                                      <option value="">Not recorded</option>
                                      <option value="up">{FACING_LABELS.up}</option>
                                      <option value="down">{FACING_LABELS.down}</option>
                                    </Select>
                                  </div>
                                )}
                              </div>
                              {l && l.kind === "zone" && l.alsoIn.length > 0 && <p className="text-xs text-ink-muted">{landingWords(l)}</p>}
                              {r.simulated && <p className="text-xs text-ink-faint">Thrown by the app.</p>}
                            </li>
                          );
                        })}
                      </ol>

                      <div className="space-y-2">
                        <p className="text-xs text-ink-faint">The picture is an extra for pointing: choose an item, then tap the cloth where it landed. The lists above do the same.</p>
                        <div className="max-w-xs">
                          <label htmlFor={`${uid}-tap`} className="block text-xs text-ink-faint mb-1">Item to place by tapping</label>
                          <Select id={`${uid}-tap`} value={tapItem} onChange={(e) => setTapItem(Number(e.target.value))}>
                            {items.map((it, i) => <option key={it.index} value={i}>{i + 1}. {it.label}</option>)}
                          </Select>
                        </div>
                        <ClothPicture
                          zones={zones}
                          marks={marks}
                          onPick={tap}
                          label={`The cloth with ${zones.length} zone${zones.length === 1 ? "" : "s"}${marks.length ? ` and ${marks.length} item${marks.length === 1 ? "" : "s"} placed` : ""}. Use the lists above to choose where each item landed.`}
                          className="w-full max-w-md touch-manipulation"
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button disabled={busy} onClick={save}>Save where they landed</Button>
                        {loaded?.kind === "charms" && (
                          <Button variant="quiet" disabled={busy} onClick={() => send("POST", { cloth_id: clothId, from_cast: true }, "The cast is laid onto the cloth as it fell.")}>
                            Lay the cast onto this cloth as it fell
                          </Button>
                        )}
                        <Button variant="quiet" disabled={busy} onClick={() => send("POST", { cloth_id: clothId }, "The app threw them onto the cloth.")}>
                          Let the app throw them onto this cloth
                        </Button>
                        {recorded && <Button variant="danger" disabled={busy} onClick={forget}>Forget where they landed</Button>}
                      </div>
                      <p className="text-xs text-ink-faint">Letting the app throw them replaces what is recorded for this reading. It uses the random source you chose in Settings.</p>
                      {loaded?.kind === "charms" && (
                        <p className="text-xs text-ink-faint">Laying the cast onto this cloth keeps each charm where it fell and the side it showed, and says which zone it is in. It also replaces what is recorded.</p>
                      )}
                    </>
                  )}
                </>
              )}
              {message && <p role={message.ok ? "status" : "alert"} className={`text-xs ${message.ok ? "text-ink-faint" : "text-danger"}`}>{message.text}</p>}
              {recorded && (
                <section aria-label="What is recorded" className="space-y-1">
                  <h3 className="text-xs text-ink-faint uppercase tracking-widest">Recorded on {recorded.cloth_name}</h3>
                  <ul className="list-none p-0 text-sm text-ink-soft space-y-0.5">
                    {recorded.rows.map((r) => (
                      <li key={r.item_index} className="break-words">
                        {r.item_label}: {r.where_kind === "zone" ? `in ${r.zone_name}` : r.where_kind === "none" ? "on the cloth, in no zone" : "off the cloth"}
                        {r.facing ? `, ${FACING_LABELS[r.facing]}` : ""}
                        {r.simulated ? " (thrown by the app)" : ""}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>
      </section>
    </Card>
  );
}
