"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { ErrorNote, SectionLabel } from "@/components/ui/Page";
import { ARCHETYPES, REALMS } from "@/lib/archetypes-data";
import { NO_REALM, effectiveRealm, matchesRealm, realmChoices } from "@/lib/concept-realm-core";
import { LIMITS, MAX } from "@/lib/own-limits";

export interface YoursArchetype {
  id: number;
  name: string;
  realm: string | null;
  summary: string;
  light: string;
  shadow: string;
}
export interface YoursConcept {
  id: number;
  name: string;
  description: string;
  shared_archetype: { slug: string; name: string } | null;
  user_archetype: { id: number; name: string } | null;
  /** The realm the person gave it, or null. */
  realm: string | null;
  /** The realm of the archetype it sits under. */
  inherited_realm: string | null;
}
export interface LinkedPiece {
  name: string;
  href: string;
  side: "light" | "shadow" | "neutral";
}

interface Props {
  archetypes: YoursArchetype[];
  concepts: YoursConcept[];
  /** The pieces the person linked to each of theirs, keyed "a:ID" for an archetype and "c:ID" for a concept. */
  pieces: Record<string, LinkedPiece[]>;
}

const SHARED = [...ARCHETYPES].sort((a, b) => a.name.localeCompare(b.name));
const SIDE = { light: "good side", shadow: "hard side", neutral: "" } as const;

async function send(method: string, url: string, body?: unknown): Promise<string | null> {
  try {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (res.ok) return null;
    return (await res.json().catch(() => null))?.error ?? "That could not be done. Nothing was changed.";
  } catch {
    return "That could not be done. Nothing was changed.";
  }
}

function Pieces({ items }: { items: LinkedPiece[] | undefined }) {
  if (!items || items.length === 0) return <p className="text-xs text-ink-ghost">Nothing is linked to it yet. Open a card, rune, die face or oracle item and link it from there.</p>;
  return (
    <ul className="flex flex-wrap gap-1.5 list-none p-0" aria-label="Linked pieces">
      {items.map((p, i) => (
        <li key={`${p.href}-${i}`}>
          <Link href={p.href} className="inline-block rounded-full border border-line px-2.5 py-0.5 text-xs text-ink-soft hover:border-line-hover hover:text-ink-strong">
            {p.name}
            {SIDE[p.side] && <span className="text-ink-ghost"> · {SIDE[p.side]}</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ArchetypeForm({ initial, onDone, onCancel }: { initial?: YoursArchetype; onDone: () => void; onCancel: () => void }) {
  const uid = useId();
  const [v, setV] = useState({ name: initial?.name ?? "", realm: initial?.realm ?? "", summary: initial?.summary ?? "", light: initial?.light ?? "", shadow: initial?.shadow ?? "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const err = await send(initial ? "PATCH" : "POST", initial ? `/api/own/archetypes/${initial.id}` : "/api/own/archetypes", v);
    setBusy(false);
    if (err) setError(err); else onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field htmlFor={`${uid}-n`} label="Name">
        <Input id={`${uid}-n`} value={v.name} onChange={set("name")} maxLength={MAX.name} required />
      </Field>
      <Field htmlFor={`${uid}-r`} label="A group heading of your own (optional)">
        <Input id={`${uid}-r`} value={v.realm} onChange={set("realm")} maxLength={MAX.realm} />
      </Field>
      <Field htmlFor={`${uid}-s`} label="What it is, in a sentence or two (optional)">
        <Textarea id={`${uid}-s`} value={v.summary} onChange={set("summary")} maxLength={MAX.summary} rows={2} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field htmlFor={`${uid}-l`} label="When it goes well (optional)">
          <Textarea id={`${uid}-l`} value={v.light} onChange={set("light")} maxLength={MAX.side} rows={3} />
        </Field>
        <Field htmlFor={`${uid}-h`} label="When it is hard (optional)">
          <Textarea id={`${uid}-h`} value={v.shadow} onChange={set("shadow")} maxLength={MAX.side} rows={3} />
        </Field>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" disabled={busy || !v.name.trim()}>{busy ? "Saving…" : initial ? "Save" : "Make it"}</Button>
        <Button variant="quiet" onClick={onCancel}>Cancel</Button>
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
    </form>
  );
}

function ConceptForm({ initial, archetypes, onDone, onCancel }: { initial?: YoursConcept; archetypes: YoursArchetype[]; onDone: () => void; onCancel: () => void }) {
  const uid = useId();
  const startUnder = initial?.user_archetype ? `u:${initial.user_archetype.id}` : initial?.shared_archetype ? `a:${initial.shared_archetype.slug}` : "";
  const [v, setV] = useState({ name: initial?.name ?? "", description: initial?.description ?? "", under: startUnder, realm: initial?.realm ?? "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body: Record<string, unknown> = { name: v.name, description: v.description, realm: v.realm };
    if (v.under.startsWith("u:")) body.user_archetype_id = Number(v.under.slice(2));
    if (v.under.startsWith("a:")) body.shared_archetype = v.under.slice(2);
    const err = await send(initial ? "PATCH" : "POST", initial ? `/api/own/concepts/${initial.id}` : "/api/own/concepts", body);
    setBusy(false);
    if (err) setError(err); else onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field htmlFor={`${uid}-n`} label="Name">
        <Input id={`${uid}-n`} value={v.name} onChange={(e) => setV((x) => ({ ...x, name: e.target.value }))} maxLength={MAX.name} required />
      </Field>
      <Field htmlFor={`${uid}-d`} label="What it means to you (optional)">
        <Textarea id={`${uid}-d`} value={v.description} onChange={(e) => setV((x) => ({ ...x, description: e.target.value }))} maxLength={MAX.description} rows={3} />
      </Field>
      <Field htmlFor={`${uid}-u`} label="Sits under (optional)">
        <Select id={`${uid}-u`} value={v.under} onChange={(e) => setV((x) => ({ ...x, under: e.target.value }))}>
          <option value="">Nothing: it stands alone</option>
          {archetypes.length > 0 && (
            <optgroup label="Your archetypes">
              {archetypes.map((a) => <option key={a.id} value={`u:${a.id}`}>{a.name}</option>)}
            </optgroup>
          )}
          <optgroup label="Shared archetypes">
            {SHARED.map((a) => <option key={a.slug} value={`a:${a.slug}`}>{a.name}</option>)}
          </optgroup>
        </Select>
      </Field>
      <Field htmlFor={`${uid}-r`} label="Realm (optional)" hint="Leave it empty and it takes the realm of the archetype it sits under.">
        <Input id={`${uid}-r`} list={`${uid}-rl`} value={v.realm} onChange={(e) => setV((x) => ({ ...x, realm: e.target.value }))} maxLength={MAX.realm} />
      </Field>
      <datalist id={`${uid}-rl`}>
        {realmChoices([...REALMS, ...archetypes.map((a) => a.realm)]).map((r) => <option key={r} value={r} />)}
      </datalist>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" disabled={busy || !v.name.trim()}>{busy ? "Saving…" : initial ? "Save" : "Make it"}</Button>
        <Button variant="quiet" onClick={onCancel}>Cancel</Button>
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
    </form>
  );
}

/**
 * The person's own archetypes and concepts: make, change and delete them, and see what they have linked to each. Private to
 * them, and always apart from the app's own archetypes below it.
 */
export default function YourArchetypes({ archetypes, concepts, pieces }: Props) {
  const router = useRouter();
  const uid = useId();
  const [realmFilter, setRealmFilter] = useState("");
  const [editing, setEditing] = useState<string | null>(null); // "new-a", "new-c", "a:ID", "c:ID"
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const done = () => {
    setEditing(null);
    router.refresh();
  };

  async function remove(kind: "a" | "c", id: number) {
    setError(null);
    const err = await send("DELETE", `/api/own/${kind === "a" ? "archetypes" : "concepts"}/${id}`);
    setConfirming(null);
    if (err) setError(err); else router.refresh();
  }

  const realmOf = (c: YoursConcept) => effectiveRealm(c.realm, c.inherited_realm);
  const realms = realmChoices([...archetypes.map((a) => a.realm), ...concepts.map(realmOf)]);
  const inRealm = (c: YoursConcept) => matchesRealm(realmOf(c), realmFilter);
  const under = (a: YoursArchetype) => concepts.filter((c) => c.user_archetype?.id === a.id && inRealm(c));
  // With a realm chosen, an archetype shows when it is in that realm or one of its concepts is.
  const shownArchetypes = archetypes.filter((a) => matchesRealm(a.realm?.trim() || null, realmFilter) || under(a).length > 0);
  const lonely = concepts.filter((c) => !c.user_archetype && inRealm(c));

  const conceptRow = (c: YoursConcept) =>
    editing === `c:${c.id}` ? (
      <Card key={c.id} pad="sm"><ConceptForm initial={c} archetypes={archetypes} onDone={done} onCancel={() => setEditing(null)} /></Card>
    ) : (
      <Card key={c.id} pad="sm" className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-medium text-ink-strong break-words">
            {realmOf(c) && (
              <span className="block text-[10px] text-tone-400 font-normal uppercase tracking-widest break-words">
                {realmOf(c)}{!c.realm?.trim() && <span className="normal-case tracking-normal text-ink-ghost"> (from its archetype)</span>}
              </span>
            )}
            {c.name}
            {c.shared_archetype && (
              <span className="text-xs text-ink-faint font-normal"> · under <Link href={`/archetypes/${c.shared_archetype.slug}`} className="underline hover:text-ink-soft">{c.shared_archetype.name}</Link></span>
            )}
          </p>
          <span className="flex gap-3">
            <button type="button" onClick={() => setEditing(`c:${c.id}`)} className="text-xs text-accent-ink hover:text-accent-ink-hover">Edit</button>
            {confirming === `c:${c.id}` ? (
              <span className="text-xs text-ink-muted">
                Delete it and your links to it?{" "}
                <button type="button" onClick={() => remove("c", c.id)} className="text-danger-ink hover:text-danger-soft">Yes, delete</button>{" "}
                <button type="button" onClick={() => setConfirming(null)} className="text-ink-faint hover:text-ink-soft">Cancel</button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirming(`c:${c.id}`)} className="text-xs text-ink-ghost hover:text-danger-ink">Delete</button>
            )}
          </span>
        </div>
        {c.description && <p className="text-sm text-ink-soft leading-relaxed whitespace-pre-wrap break-words">{c.description}</p>}
        <Pieces items={pieces[`c:${c.id}`]} />
      </Card>
    );

  return (
    <section aria-labelledby="yours-h" className="space-y-4">
      <div className="space-y-1">
        <SectionLabel id="yours-h">Yours</SectionLabel>
        <p className="text-sm text-ink-muted leading-relaxed max-w-2xl">
          Make archetypes and concepts of your own, then link any card, rune, ogham letter, die face, pendulum swing or oracle
          item to them from that piece&rsquo;s page. Only you can see them, and they are kept apart from the app&rsquo;s own
          archetypes below. You can keep up to {LIMITS.archetypes} archetypes, {LIMITS.concepts} concepts and {LIMITS.links} links.
        </p>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      {realms.length > 0 && (
        <div className="max-w-xs">
          <Field htmlFor={`${uid}-realm`} label="Show the realm">
            <Select id={`${uid}-realm`} value={realmFilter} onChange={(e) => setRealmFilter(e.target.value)}>
              <option value="">All realms</option>
              {realms.map((r) => <option key={r} value={r}>{r}</option>)}
              <option value={NO_REALM}>No realm yet</option>
            </Select>
          </Field>
        </div>
      )}

      {shownArchetypes.map((a) =>
        editing === `a:${a.id}` ? (
          <Card key={a.id}><ArchetypeForm initial={a} onDone={done} onCancel={() => setEditing(null)} /></Card>
        ) : (
          <Card key={a.id} className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="min-w-0">
                {a.realm && <p className="text-[10px] text-tone-400 uppercase tracking-widest break-words">{a.realm}</p>}
                <h3 className="font-semibold text-ink-strong break-words">{a.name}</h3>
              </div>
              <span className="flex gap-3">
                <button type="button" onClick={() => setEditing(`a:${a.id}`)} className="text-xs text-accent-ink hover:text-accent-ink-hover">Edit</button>
                {confirming === `a:${a.id}` ? (
                  <span className="text-xs text-ink-muted">
                    Delete it and your links to it? Its concepts stay.{" "}
                    <button type="button" onClick={() => remove("a", a.id)} className="text-danger-ink hover:text-danger-soft">Yes, delete</button>{" "}
                    <button type="button" onClick={() => setConfirming(null)} className="text-ink-faint hover:text-ink-soft">Cancel</button>
                  </span>
                ) : (
                  <button type="button" onClick={() => setConfirming(`a:${a.id}`)} className="text-xs text-ink-ghost hover:text-danger-ink">Delete</button>
                )}
              </span>
            </div>
            {a.summary && <p className="text-sm text-ink-soft leading-relaxed whitespace-pre-wrap break-words">{a.summary}</p>}
            {(a.light || a.shadow) && (
              <div className="grid gap-3 sm:grid-cols-2">
                {a.light && <div><p className="text-[10px] text-tone-400 uppercase tracking-widest mb-1">When it goes well</p><p className="text-sm text-ink-soft whitespace-pre-wrap break-words">{a.light}</p></div>}
                {a.shadow && <div><p className="text-[10px] text-tone-400 uppercase tracking-widest mb-1">When it is hard</p><p className="text-sm text-ink-soft whitespace-pre-wrap break-words">{a.shadow}</p></div>}
              </div>
            )}
            <Pieces items={pieces[`a:${a.id}`]} />
            {under(a).length > 0 && (
              <div className="space-y-2 border-t border-line-faint pt-3">
                <p className="text-xs text-ink-faint">Concepts under it</p>
                {under(a).map(conceptRow)}
              </div>
            )}
          </Card>
        )
      )}

      {lonely.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-ink-faint">Concepts not under one of your archetypes</p>
          {lonely.map(conceptRow)}
        </div>
      )}

      {archetypes.length === 0 && concepts.length === 0 && editing === null && (
        <p className="text-sm text-ink-faint italic">You have not made any yet.</p>
      )}
      {realmFilter && shownArchetypes.length === 0 && lonely.length === 0 && (
        <p className="text-sm text-ink-faint italic">None of yours are in that realm.</p>
      )}

      {editing === "new-a" && <Card><ArchetypeForm onDone={done} onCancel={() => setEditing(null)} /></Card>}
      {editing === "new-c" && <Card><ConceptForm archetypes={archetypes} onDone={done} onCancel={() => setEditing(null)} /></Card>}
      {editing === null || editing.startsWith("a:") || editing.startsWith("c:") ? (
        <div className="flex flex-wrap gap-3">
          <Button variant="purple" onClick={() => setEditing("new-a")}>Make an archetype</Button>
          <Button variant="quiet" onClick={() => setEditing("new-c")}>Make a concept</Button>
        </div>
      ) : null}
    </section>
  );
}
