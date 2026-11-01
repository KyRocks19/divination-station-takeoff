"use client";

import { useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { ErrorNote, SectionLabel } from "@/components/ui/Page";
import ClothPicture from "@/components/cloth/ClothPicture";
import {
  EDGES, MAX_CLOTH_DESCRIPTION, MAX_CLOTH_NAME, MAX_ZONES, MAX_ZONE_NAME, MAX_ZONE_NOTE, SHAPE_LABELS, ZONE_SHAPES, cleanCloth, describeGeom,
  type Zone, type ZoneShape,
} from "@/lib/cloth-core";
import { SHAPE_FIELDS, defaultForm, formToGeom, geomToForm, type GeomForm } from "@/lib/cloth-form";
import { dragTo, handlesFor } from "@/lib/cloth-drag";

interface FormZone {
  key: number;
  name: string;
  note: string;
  /** "" means no colour (the picture uses the tone colour). */
  color: string;
  shape: ZoneShape;
  form: GeomForm;
}

interface Props {
  /** Present when editing a cloth that exists. */
  initial?: { id: number; name: string; description: string; zones: Zone[] };
}

const toFormZone = (z: Zone, key: number): FormZone => ({ key, name: z.name, note: z.note ?? "", color: z.color ?? "", shape: z.geom.shape, form: geomToForm(z.geom) });

/**
 * Makes or changes a cloth: a name, and zones with their shapes. The boxes are the real way to make a zone (they work by keyboard and screen
 * reader); the picture shows what they say. Zone names, notes and colours are the person's own: the app gives none.
 */
export default function ClothEditor({ initial }: Props) {
  const uid = useId();
  const router = useRouter();
  const nextKey = useRef((initial?.zones.length ?? 0) + 1);
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [zones, setZones] = useState<FormZone[]>(() => (initial?.zones ?? []).map((z, i) => toFormZone(z, i)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // What each zone's boxes say now, so the picture follows as they type; a zone whose boxes are not usable yet says why and is left out of the picture.
  const parsed = useMemo(
    () => zones.map((z) => ({ z, geom: formToGeom(z.shape, z.form) })),
    [zones]
  );
  const drawn: Zone[] = parsed.flatMap(({ z, geom }) => (geom.ok ? [{ name: z.name.trim() || "(no name)", note: null, color: z.color || null, geom: geom.geom }] : []));

  // The zone whose dots are shown on the picture: the one the person last worked on (the first one until they do).
  const [picked, setPicked] = useState<number | null>(null);
  const dragged = parsed.find(({ z }) => z.key === picked) ?? parsed[0];
  const draggedGeom = dragged?.geom.ok ? dragged.geom.geom : null;
  const dragZone = (id: string, x: number, y: number) => {
    if (!dragged || !draggedGeom) return;
    const next = dragTo(draggedGeom, id, x, y);
    if (next === draggedGeom) return;
    // The dragged shape goes back into the boxes, so the boxes and the picture always say the same thing.
    setZones((list) => list.map((z) => (z.key === dragged.z.key ? { ...z, form: geomToForm(next) } : z)));
    setSaved(false);
  };

  const change = (key: number, patch: Partial<FormZone>) => {
    setZones((list) => list.map((z) => (z.key === key ? { ...z, ...patch } : z)));
    setSaved(false);
  };
  const setField = (key: number, field: string, value: string) =>
    setZones((list) => list.map((z) => (z.key === key ? { ...z, form: { ...z.form, [field]: value } } : z)));
  const move = (index: number, by: -1 | 1) =>
    setZones((list) => {
      const to = index + by;
      if (to < 0 || to >= list.length) return list;
      const copy = [...list];
      [copy[index], copy[to]] = [copy[to], copy[index]];
      return copy;
    });

  /** The cloth as the server wants it, or the sentence saying what is wrong. */
  function build(): { ok: true; body: { name: string; description: string; zones: unknown[] } } | { ok: false; error: string } {
    const out: unknown[] = [];
    for (const { z, geom } of parsed) {
      if (!geom.ok) return { ok: false, error: `${z.name.trim() || "A zone"}: ${geom.error}` };
      out.push({ name: z.name, note: z.note, color: z.color || null, geom: geom.geom });
    }
    const body = { name, description, zones: out };
    const checked = cleanCloth(body);
    return checked.ok ? { ok: true, body } : { ok: false, error: checked.error };
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const b = build();
    if (!b.ok) {
      setError(b.error);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(initial ? `/api/cloths/${initial.id}` : "/api/cloths", {
        method: initial ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(b.body),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(typeof body?.error === "string" ? body.error : "Could not save the cloth.");
      if (initial) {
        setSaved(true);
        router.refresh();
      } else {
        router.push(`/lots/cloths/${body.id}`);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the cloth. What you typed is still here; try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!initial) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/cloths/${initial.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.push("/lots");
      router.refresh();
    } catch {
      setError("Could not delete the cloth. Nothing was changed.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <div className="space-y-3">
        <div>
          <label htmlFor={`${uid}-name`} className="block text-xs text-ink-faint mb-1">Name of the cloth</label>
          <Input id={`${uid}-name`} value={name} maxLength={MAX_CLOTH_NAME} onChange={(e) => { setName(e.target.value); setSaved(false); }} autoComplete="off" />
        </div>
        <div>
          <label htmlFor={`${uid}-desc`} className="block text-xs text-ink-faint mb-1">About this cloth, in your own words (optional)</label>
          <Textarea id={`${uid}-desc`} value={description} maxLength={MAX_CLOTH_DESCRIPTION} rows={2} onChange={(e) => { setDescription(e.target.value); setSaved(false); }} />
        </div>
      </div>

      <section aria-labelledby={`${uid}-pic`} className="space-y-2">
        <SectionLabel id={`${uid}-pic`}>What it looks like</SectionLabel>
        <ClothPicture
          zones={drawn}
          label={drawn.length ? `A square cloth with ${drawn.length} zone${drawn.length === 1 ? "" : "s"}: ${drawn.map((z) => z.name).join(", ")}. The same zones are listed below.` : "An empty square cloth."}
          className="w-full max-w-md"
          handles={draggedGeom ? handlesFor(draggedGeom) : []}
          onHandleDrag={dragZone}
        />
        <p className="text-xs text-ink-faint">
          The boxes below are the way to set a zone. With a mouse, pen or finger you can also drag the round dots on the picture to move or resize
          {dragged && dragged.z.name.trim() ? ` ${dragged.z.name.trim()}` : " the zone you last worked on"}; the boxes change to match. Places are percents of the cloth: 0 is the left or top edge and 100 is the right or bottom edge.
        </p>
      </section>

      <section aria-labelledby={`${uid}-zones`} className="space-y-3">
        <SectionLabel id={`${uid}-zones`}>Zones</SectionLabel>
        <p className="text-xs text-ink-faint">
          A zone is an area of the cloth that you name, such as &ldquo;the inner ring&rdquo; or &ldquo;the left half&rdquo;. An item belongs to the zone it lands in. If zones
          overlap, an item belongs to the smallest zone that holds it. The app gives no zone a meaning: what a zone means is for you to say.
        </p>
        {zones.length === 0 && <p className="text-sm text-ink-ghost">No zones yet. A cloth with no zones is still a cloth: items can land on it, in no zone.</p>}
        <ol className="list-none p-0 space-y-4">
          {zones.map((z, i) => {
            const g = parsed[i].geom;
            return (
              <li key={z.key}>
                <fieldset className="space-y-3 bg-surface border border-line rounded-card p-4" onFocus={() => setPicked(z.key)} onPointerDown={() => setPicked(z.key)}>
                  <legend className="text-sm text-ink-strong font-medium px-1">Zone {i + 1}{z.name.trim() ? `: ${z.name.trim()}` : ""}</legend>
                  <div>
                    <label htmlFor={`${uid}-zn-${z.key}`} className="block text-xs text-ink-faint mb-1">Name of the zone</label>
                    <Input id={`${uid}-zn-${z.key}`} value={z.name} maxLength={MAX_ZONE_NAME} onChange={(e) => change(z.key, { name: e.target.value })} autoComplete="off" />
                  </div>
                  <div>
                    <label htmlFor={`${uid}-zt-${z.key}`} className="block text-xs text-ink-faint mb-1">Your note on this zone (optional)</label>
                    <Textarea id={`${uid}-zt-${z.key}`} value={z.note} maxLength={MAX_ZONE_NOTE} rows={2} onChange={(e) => change(z.key, { note: e.target.value })} />
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-ink-soft">
                      <input type="checkbox" className="accent-tone-500" checked={z.color !== ""} onChange={(e) => change(z.key, { color: e.target.checked ? "#a855f7" : "" })} />
                      <span>Give it a colour</span>
                    </label>
                    {z.color !== "" && (
                      <span className="flex items-center gap-2 text-xs text-ink-faint">
                        <label htmlFor={`${uid}-zc-${z.key}`}>Colour</label>
                        <input id={`${uid}-zc-${z.key}`} type="color" value={z.color} onChange={(e) => change(z.key, { color: e.target.value })} className="h-8 w-12 bg-transparent" />
                      </span>
                    )}
                  </div>
                  <div>
                    <label htmlFor={`${uid}-zs-${z.key}`} className="block text-xs text-ink-faint mb-1">Shape</label>
                    <Select
                      id={`${uid}-zs-${z.key}`}
                      value={z.shape}
                      onChange={(e) => change(z.key, { shape: e.target.value as ZoneShape, form: defaultForm(e.target.value as ZoneShape) })}
                    >
                      {ZONE_SHAPES.map((s) => <option key={s} value={s}>{SHAPE_LABELS[s]}</option>)}
                    </Select>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {SHAPE_FIELDS[z.shape].map((f) => (
                      <div key={f.name} className={f.unit === "list" ? "sm:col-span-2" : ""}>
                        <label htmlFor={`${uid}-zf-${z.key}-${f.name}`} className="block text-xs text-ink-faint mb-1">
                          {f.label}{f.unit === "%" ? " (percent)" : f.unit === "°" ? " (degrees)" : ""}
                        </label>
                        {f.unit === "side" ? (
                          <Select id={`${uid}-zf-${z.key}-${f.name}`} value={z.form[f.name] ?? "left"} onChange={(e) => { setField(z.key, f.name, e.target.value); setSaved(false); }}>
                            {EDGES.map((edge) => <option key={edge} value={edge}>{edge[0].toUpperCase() + edge.slice(1)}</option>)}
                          </Select>
                        ) : f.unit === "list" ? (
                          <Textarea id={`${uid}-zf-${z.key}-${f.name}`} rows={4} value={z.form[f.name] ?? ""} onChange={(e) => { setField(z.key, f.name, e.target.value); setSaved(false); }} className="font-mono text-xs" />
                        ) : (
                          <Input id={`${uid}-zf-${z.key}-${f.name}`} value={z.form[f.name] ?? ""} inputMode="decimal" onChange={(e) => { setField(z.key, f.name, e.target.value); setSaved(false); }} autoComplete="off" />
                        )}
                      </div>
                    ))}
                  </div>
                  {g.ok ? (
                    <p className="text-xs text-ink-muted">{describeGeom(g.geom)}.</p>
                  ) : (
                    <p role="alert" className="text-xs text-danger">{g.error}</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button variant="quiet" disabled={i === 0} onClick={() => move(i, -1)}>Move up</Button>
                    <Button variant="quiet" disabled={i === zones.length - 1} onClick={() => move(i, 1)}>Move down</Button>
                    <Button variant="danger" onClick={() => { setZones((list) => list.filter((x) => x.key !== z.key)); setSaved(false); }}>Remove this zone</Button>
                  </div>
                </fieldset>
              </li>
            );
          })}
        </ol>
        <Button
          variant="quiet"
          disabled={zones.length >= MAX_ZONES}
          onClick={() => { setZones((list) => [...list, { key: nextKey.current++, name: "", note: "", color: "", shape: "circle", form: defaultForm("circle") }]); setSaved(false); }}
        >
          Add a zone
        </Button>
        {zones.length >= MAX_ZONES && <p className="text-xs text-ink-faint">A cloth can have {MAX_ZONES} zones.</p>}
      </section>

      {error && <ErrorNote>{error}</ErrorNote>}
      {saved && <p role="status" className="text-xs text-ink-faint">Saved.</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy || !name.trim()}>{busy ? "Saving…" : initial ? "Save the cloth" : "Make the cloth"}</Button>
        {initial && !confirmDelete && <Button variant="danger" disabled={busy} onClick={() => setConfirmDelete(true)}>Delete this cloth</Button>}
        {initial && confirmDelete && (
          <span className="text-xs text-ink-muted">
            Delete this cloth? Where items landed on it stays in your readings. This cannot be undone.{" "}
            <button type="button" onClick={remove} disabled={busy} className="text-danger-ink hover:text-danger-soft">Yes, delete it</button>{" "}
            <button type="button" onClick={() => setConfirmDelete(false)} className="text-ink-faint hover:text-ink-soft">Keep it</button>
          </span>
        )}
      </div>
    </form>
  );
}
