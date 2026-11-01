"use client";

import SceneIdeas from "@/components/oracle/SceneIdeas";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { buttonClass } from "@/components/ui/Button";
import { fieldFullClass } from "@/components/ui/Field";
import { SectionLabel } from "@/components/ui/Page";
import {
  DEFAULT_BATCH,
  ENLARGE_FACTORS,
  LOCAL_IMAGE_TOOL,
  MAX_BATCH,
  MAX_STYLE_LENGTH,
  MAX_FAILURES_IN_A_ROW,
  NEGATIVE_PROMPT,
  ImageToolError,
  cleanBatch,
  enlargePicture,
  joinPrompt,
  makePicture,
  shouldGoOn,
  suggestAlt,
  testImageTool,
} from "@/lib/art-maker";
import {
  CARD_TIPS,
  MAX_SCENE_LENGTH,
  SCENE_WORD_LIMIT,
  STYLE_PRESETS,
  composeScene,
  compositionFor,
  defaultSelection,
  sceneSources,
  wordCount,
  type SceneCard,
} from "@/lib/art-scene";
import { dataUrlToBlob, shrinkImage } from "@/lib/oracle-art-client";
import { MAX_ALT_LENGTH, limitsFor } from "@/lib/oracle-art";
import { formWords } from "@/lib/oracle-forms";
import { MAX_ART_STYLE_NAME, addToNote, type SavedStyle } from "@/lib/art-styles-core";
import { parseOracleArtMakerDraft } from "@/lib/oracle-art-draft-core";

type State = "new" | "busy" | "used" | "saved";
interface Result {
  key: number;
  src: string;
  prompt: string;
  state: State;
  /** Pixel size, read from the picture once it has loaded. */
  size?: string;
  /** Whether this picture has been made larger. */
  enlarged?: boolean;
  /** The queue entry it came from (queue mode); cleared from the server once the picture is kept or discarded. */
  jobId?: number;
}

interface JobRow {
  id: number;
  status: "queued" | "running" | "done" | "failed";
  error: string | null;
  prompt: string;
  ahead: number;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

interface Props {
  cardId: number;
  /** The set the item is in: its saved style note is the starting point for the style box. */
  deckId: number;
  form: string;
  /** The person's own writing on the item. Only the parts they tick are used. */
  card: SceneCard;
  hasArt: boolean;
  /** Whether the app has an image tool address set up (IMAGE_GEN_URL). The address itself never reaches the browser. */
  imageToolReady: boolean;
  /** "queue": pictures wait for the owner's computer to make them; "direct": this server asks the image tool itself. */
  imageMode: "direct" | "queue";
  /** Whether pictures are kept as files on disk, which allows larger pictures. */
  onDisk: boolean;
  onChanged: () => void | Promise<void>;
}

/**
 * Asks an image tool on the owner's computer for pictures, from words the person chooses and can change first.
 * Nothing is saved until they press a button on a picture: use it on this item, keep it in the gallery, or discard it.
 */
export default function ArtMaker({ cardId, deckId, form, card, hasArt, imageToolReady, imageMode, onDisk, onChanged }: Props) {
  const uid = useId();
  const queued = imageMode === "queue";
  const w = formWords(form);
  const sources = useMemo(() => sceneSources(card), [card]);
  const [selected, setSelected] = useState<string[]>(() => defaultSelection(sources));
  const [scene, setScene] = useState(() => composeScene(sources, defaultSelection(sources)));
  const [sceneEdited, setSceneEdited] = useState(false);
  const [style, setStyle] = useState("");
  // Saved style notes: the one saved for this set, and the person's own named styles (migration 078).
  const [deckNote, setDeckNote] = useState<string | null>(null);
  const [savedStyles, setSavedStyles] = useState<SavedStyle[]>([]);
  const [styleName, setStyleName] = useState("");
  const [styleMessage, setStyleMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [useComposition, setUseComposition] = useState(true);
  const [count, setCount] = useState(DEFAULT_BATCH);
  const [alt, setAlt] = useState(() => suggestAlt(scene));
  const [altEdited, setAltEdited] = useState(false);
  // Tags for a picture kept in the gallery, typed as one line (P4e); the gallery page is where tags are changed afterwards.
  const [keepTags, setKeepTags] = useState("");
  const [draftReady, setDraftReady] = useState(false);
  const [draftStorageError, setDraftStorageError] = useState<string | null>(null);
  const [draftClearStatus, setDraftClearStatus] = useState<string | null>(null);
  const [draftRevision, setDraftRevision] = useState(0);
  const [results, setResults] = useState<Result[]>([]);
  const [running, setRunning] = useState<{ done: number; total: number } | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [checking, setChecking] = useState(false);
  const [canEnlarge, setCanEnlarge] = useState<boolean | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);
  // Seconds the current picture has been running, so a slow model does not look stuck.
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!running) {
      setElapsed(0);
      return;
    }
    const start = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [running?.done, running?.total, !!running]); // eslint-disable-line react-hooks/exhaustive-deps
  const nextKey = useRef(1);
  const abort = useRef<AbortController | null>(null);
  const draftWasRestored = useRef(false);
  const skipDraftWrite = useRef(false);
  const draftStorageKey = `divination-station:oracle-art-maker:v1:${cardId}`;

  const composition = useComposition ? compositionFor(form) : "";
  const prompt = joinPrompt(scene, style, composition);
  const promptWords = wordCount(prompt);

  // The suggested description follows the scene until the person edits it themselves.
  useEffect(() => {
    if (!altEdited) setAlt(suggestAlt(scene));
  }, [scene, altEdited]);
  useEffect(() => {
    draftWasRestored.current = false;
    let raw: string | null;
    try {
      raw = window.localStorage.getItem(draftStorageKey);
    } catch {
      setDraftStorageError("Could not read the saved draft on this device. The form is still available, but saved edits may not appear.");
      return;
    }

    if (raw) {
      let value: unknown;
      try {
        value = JSON.parse(raw);
      } catch {
        value = null;
      }
      const draft = parseOracleArtMakerDraft(value, sources.map((source) => source.id));
      if (draft) {
        draftWasRestored.current = true;
        if (draft.selected) setSelected(draft.selected);
        if (draft.scene !== undefined) setScene(draft.scene);
        if (draft.sceneEdited !== undefined) setSceneEdited(draft.sceneEdited);
        if (draft.style !== undefined) setStyle(draft.style);
        if (draft.styleName !== undefined) setStyleName(draft.styleName);
        if (draft.useComposition !== undefined) setUseComposition(draft.useComposition);
        if (draft.count !== undefined) setCount(draft.count);
        if (draft.alt !== undefined) setAlt(draft.alt);
        if (draft.altEdited !== undefined) setAltEdited(draft.altEdited);
      }
    }
    setDraftReady(true);
  }, [draftStorageKey, sources]);
  useEffect(() => {
    if (!draftReady) return;
    if (skipDraftWrite.current) {
      skipDraftWrite.current = false;
      return;
    }
    try {
      window.localStorage.setItem(draftStorageKey, JSON.stringify({
        version: 1,
        selected,
        scene,
        sceneEdited,
        style,
        styleName,
        useComposition,
        count,
        alt,
        altEdited,
      }));
      setDraftStorageError(null);
    } catch {
      setDraftStorageError("Could not save this draft on this device. Your edits are still on this page, but may be lost if you reload.");
    }
  }, [alt, altEdited, count, draftReady, draftRevision, draftStorageKey, scene, sceneEdited, selected, style, styleName, useComposition]);
  useEffect(() => () => abort.current?.abort(), []);

  function toggle(id: string) {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    setSelected(next);
    // The words follow the ticks until the person has typed in the box themselves.
    if (!sceneEdited) setScene(composeScene(sources, next));
  }

  function rebuild() {
    setScene(composeScene(sources, selected));
    setSceneEdited(false);
  }

  function addPreset(text: string) {
    setStyle((s) => addToNote(s, text));
  }

  function clearDraft() {
    const initialSelected = defaultSelection(sources);
    const initialScene = composeScene(sources, initialSelected);
    let removed = false;
    setDraftClearStatus(null);
    try {
      window.localStorage.removeItem(draftStorageKey);
      setDraftStorageError(null);
      setDraftClearStatus("Saved draft cleared. The form has been reset.");
      removed = true;
    } catch {
      setDraftStorageError("Could not clear the saved draft from this device. It may return after a reload.");
    }
    if (removed) {
      draftWasRestored.current = false;
      setDraftReady(true);
      skipDraftWrite.current = true;
      setDraftRevision((revision) => revision + 1);
    }
    setSelected(initialSelected);
    setScene(initialScene);
    setSceneEdited(false);
    setStyle(deckNote ?? "");
    setStyleName("");
    setUseComposition(true);
    setCount(DEFAULT_BATCH);
    setAlt(suggestAlt(initialScene));
    setAltEdited(false);
  }

  // The set's saved note starts the style box (only while the box is still empty), and the person's saved styles are listed.
  useEffect(() => {
    let live = true;
    fetch(`/api/oracle/styles?deck=${deckId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!live || !d) return;
        setSavedStyles(d.styles ?? []);
        setDeckNote(d.deck_style ?? null);
        if (d.deck_style && !draftWasRestored.current) setStyle((s) => (s === "" ? d.deck_style : s));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [deckId]);

  async function styleCall(url: string, method: string, body: unknown, done: (data: any) => void, ok: string) {
    setStyleMessage(null);
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
      const data = res.status === 204 ? null : await res.json().catch(() => null);
      if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "That could not be saved.");
      done(data);
      setStyleMessage({ ok: true, text: ok });
    } catch (err) {
      setStyleMessage({ ok: false, text: err instanceof Error ? err.message : "That could not be saved. Nothing was changed." });
    }
  }
  const saveForSet = () => styleCall(`/api/oracle/decks/${deckId}/style`, "PUT", { style }, (d) => setDeckNote(d?.style ?? null), "Saved as the style for this set.");
  const clearForSet = () => styleCall(`/api/oracle/decks/${deckId}/style`, "PUT", { style: "" }, () => setDeckNote(null), "The set no longer has a saved style.");
  const saveNamed = () =>
    styleCall("/api/oracle/styles", "POST", { name: styleName, text: style }, (d) => { setSavedStyles((l) => [...l, d]); setStyleName(""); }, "Saved to your styles.");
  const removeNamed = (s: SavedStyle) =>
    styleCall(`/api/oracle/styles/${s.id}`, "DELETE", undefined, () => setSavedStyles((l) => l.filter((x) => x.id !== s.id)), `Removed the style ${s.name}.`);

  // --- Queue mode: pictures wait for the owner's computer, so they are asked for, polled for, and collected when finished. ---
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [studio, setStudio] = useState<{ awake: boolean; circle_name?: string | null } | null>(null);
  // Whose computer makes the pictures: a circle's, when the person is in a circle that has one and they agreed to use it; otherwise the owner's.
  const hostWords = studio?.circle_name ? `your circle's picture computer (${studio.circle_name})` : "the owner's computer";
  const [asking, setAsking] = useState(false);
  const adopted = useRef(new Set<number>());
  const polls = useRef(0);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  async function refreshJobs() {
    const res = await fetch(`/api/oracle/image-jobs?card_id=${cardId}`).catch(() => null);
    if (!res || !res.ok || !alive.current) return;
    const body = await res.json().catch(() => null);
    if (!body || !alive.current) return;
    setStudio(body.studio ?? null);
    const list: (JobRow & { status: string })[] = body.jobs ?? [];
    setJobs(list.filter((j) => j.status !== "done") as JobRow[]);
    for (const j of list.filter((x) => x.status === "done" && !adopted.current.has(x.id))) {
      adopted.current.add(j.id);
      try {
        const img = await fetch(`/api/oracle/image-jobs/${j.id}/image`);
        if (!img.ok) throw new Error();
        const src = await blobToDataUrl(await img.blob());
        if (alive.current) setResults((rs) => [...rs, { key: nextKey.current++, src, prompt: j.prompt, state: "new", jobId: j.id }]);
      } catch {
        adopted.current.delete(j.id);
      }
    }
  }

  // On arrival, pick up pictures that were asked for earlier (waiting, or finished while the page was closed).
  useEffect(() => {
    if (queued) void refreshJobs();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // While pictures are waiting, look again every few seconds, a little slower the longer it takes.
  const activeJobs = jobs.filter((j) => j.status === "queued" || j.status === "running").length;
  useEffect(() => {
    if (!queued || activeJobs === 0) {
      polls.current = 0;
      return;
    }
    const wait = Math.min(30_000, 4000 + polls.current * 2000);
    const timer = setTimeout(() => {
      polls.current++;
      if (!document.hidden) void refreshJobs();
      else setJobs((js) => [...js]);
    }, wait);
    return () => clearTimeout(timer);
  }, [queued, activeJobs, jobs]); // eslint-disable-line react-hooks/exhaustive-deps

  async function generateQueued() {
    if (!prompt) {
      setMessage({ ok: false, text: "Tick or write a few words about the picture first." });
      return;
    }
    setAsking(true);
    setMessage(null);
    try {
      const res = await fetch("/api/oracle/image-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, form, count: cleanBatch(count), card_id: cardId }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setMessage({ ok: false, text: typeof body?.error === "string" ? body.error : "Could not ask for pictures. Try again." });
        return;
      }
      setStudio(body.studio ?? null);
      polls.current = 0;
      const n = body.ids?.length ?? 0;
      setMessage({
        ok: true,
        text: body.studio?.awake
          ? `Asked for ${n} picture${n === 1 ? "" : "s"}. They appear here as they are made.`
          : `Asked for ${n} picture${n === 1 ? "" : "s"}. The picture studio is asleep right now (it runs on ${body.studio?.circle_name ? `your circle's picture computer (${body.studio.circle_name})` : "the owner's computer"}), so they will be made when it wakes. You can leave this page and come back; they are kept for 24 hours.`,
      });
      await refreshJobs();
    } catch {
      setMessage({ ok: false, text: "Could not reach the app. Check your connection and try again." });
    } finally {
      setAsking(false);
    }
  }

  async function dropJob(id: number) {
    await fetch(`/api/oracle/image-jobs/${id}`, { method: "DELETE" }).catch(() => {});
  }

  async function cancelWaiting() {
    await Promise.all(jobs.filter((j) => j.status === "queued" || j.status === "running").map((j) => dropJob(j.id)));
    await refreshJobs();
  }

  async function clearFailed(id: number) {
    await dropJob(id);
    await refreshJobs();
  }

  function patch(key: number, change: Partial<Result>) {
    setResults((rs) => rs.map((r) => (r.key === key ? { ...r, ...change } : r)));
  }

  async function check(quiet = false) {
    if (!quiet) {
      setChecking(true);
      setMessage(null);
    }
    const res = await testImageTool();
    if (!quiet) setChecking(false);
    if (res.ok) setCanEnlarge(res.canEnlarge);
    if (!quiet) {
      setMessage(
        res.ok
          ? {
              ok: true,
              text: res.canEnlarge
                ? "Connected. “Make larger” is available."
                : "Connected. “Make larger” is not set up yet (see the note under the pictures).",
            }
          : { ok: false, text: res.message }
      );
    }
  }

  async function generate() {
    if (!imageToolReady || running) return;
    if (queued) return generateQueued();
    if (!prompt) {
      setMessage({ ok: false, text: "Tick or write a few words about the picture first." });
      return;
    }
    const total = cleanBatch(count);
    const controller = new AbortController();
    abort.current = controller;
    setMessage(null);
    let made = 0;
    let inARow = 0;
    const problems: string[] = [];
    for (let i = 0; i < total; i++) {
      setRunning({ done: i, total });
      try {
        const src = await makePicture({ prompt, form, signal: controller.signal });
        setResults((rs) => [...rs, { key: nextKey.current++, src, prompt, state: "new" }]);
        made++;
        inARow = 0;
        if (canEnlarge === null) void check(true);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") break;
        problems.push(`Picture ${i + 1}: ${err instanceof Error ? err.message : "could not be made."}`);
        inARow++;
        // One picture that failed does not end the batch, unless nothing later is likely to work.
        const status = err instanceof ImageToolError ? err.status : 0;
        if (!shouldGoOn(status) || inARow >= MAX_FAILURES_IN_A_ROW) break;
      }
    }
    if (problems.length) {
      setMessage({ ok: false, text: `${made} of ${total} picture${total === 1 ? "" : "s"} made. ${problems.join(" ")}` });
    }
    setRunning(null);
    abort.current = null;
  }

  function stop() {
    abort.current?.abort();
  }

  async function enlarge(r: Result, factor: number) {
    patch(r.key, { state: "busy" });
    setMessage(null);
    const controller = new AbortController();
    abort.current = controller;
    try {
      const src = await enlargePicture({ image: r.src, factor, signal: controller.signal });
      patch(r.key, { src, state: "new", enlarged: true, size: undefined });
    } catch (err) {
      patch(r.key, { state: "new" });
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setMessage({ ok: false, text: err instanceof Error ? err.message : "Could not make that picture larger." });
      }
    } finally {
      abort.current = null;
    }
  }

  const limits = limitsFor(onDisk);
  async function shrunk(r: Result): Promise<string> {
    return shrinkImage(dataUrlToBlob(r.src), limits);
  }

  async function putHere(r: Result) {
    patch(r.key, { state: "busy" });
    setConfirming(null);
    setMessage(null);
    try {
      const image = await shrunk(r);
      const res = await fetch(`/api/oracle/cards/${cardId}/art`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "upload", image, alt, made_with: LOCAL_IMAGE_TOOL }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || "Could not save the picture.");
      patch(r.key, { state: "used", jobId: undefined });
      if (r.jobId) void dropJob(r.jobId);
      setMessage({ ok: true, text: "That picture is now on this item." });
      await onChanged();
    } catch (err) {
      patch(r.key, { state: "new" });
      setMessage({ ok: false, text: err instanceof Error && err.message ? err.message : "Could not save the picture. Nothing was changed." });
    }
  }

  async function keepInGallery(r: Result) {
    patch(r.key, { state: "busy" });
    setMessage(null);
    try {
      const image = await shrunk(r);
      const res = await fetch("/api/oracle/gallery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, alt, prompt: r.prompt, made_with: LOCAL_IMAGE_TOOL, tags: keepTags }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || "Could not save it to the gallery.");
      patch(r.key, { state: "saved", jobId: undefined });
      if (r.jobId) void dropJob(r.jobId);
    } catch (err) {
      patch(r.key, { state: "new" });
      setMessage({ ok: false, text: err instanceof Error && err.message ? err.message : "Could not save it to the gallery." });
    }
  }

  function discard(key: number) {
    const gone = results.find((r) => r.key === key);
    if (gone?.jobId) void dropJob(gone.jobId);
    setResults((rs) => rs.filter((r) => r.key !== key));
    setConfirming(null);
  }

  const smallButton = "!px-2 !py-1 !text-xs";

  return (
    <section aria-labelledby={`${uid}-maker`} className="bg-surface border border-line rounded-card p-5 space-y-4">
      <SectionLabel id={`${uid}-maker`}>Make pictures</SectionLabel>
      <p className="text-xs text-ink-faint">
        Your unfinished form fields are kept only in this browser on this device. Saving the draft does not send its words anywhere.
        Generated pictures are not part of the saved draft.
      </p>
      {draftStorageError && (
        <p role="alert" className="text-xs text-danger">
          {draftStorageError}
        </p>
      )}
      <button type="button" onClick={clearDraft} className={buttonClass.quiet}>
        Clear the saved draft
      </button>
      {draftClearStatus && <p role="status" className="text-xs text-ink-muted">{draftClearStatus}</p>}

      {!imageToolReady ? (
        <div className="text-sm text-ink-muted space-y-2">
          <p>
            This asks an image tool running on your own computer to make pictures from your words. No image tool address is set up
            yet.
          </p>
          <p className="text-xs text-ink-faint">
            To set it up, start your image tool (for example KoboldCpp with an image model) on the computer that runs this app, then
            add <code>IMAGE_GEN_URL=http://localhost:5001</code> to <code>.env.development.local</code> and restart the app. You can switch
            this section off in Settings.
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-ink-faint">
            {queued
              ? `These words are kept on the app's server until your pictures are made, then go to the image tool on ${hostWords}, exactly as shown below, and nowhere else. That computer makes whatever words it is given, so keep them to your own scenes. Change any of them. Nothing is saved to your item until you choose a picture.`
              : "These words go to the image tool on the computer that runs this app, exactly as shown below, and nowhere else. Change any of them. Nothing is saved until you choose a picture."}
          </p>

          <fieldset className="space-y-1.5">
            <legend className="text-xs text-ink-faint">Which of your words to draw from</legend>
            <ul className="space-y-1 list-none p-0 m-0">
              {sources.map((s) => (
                <li key={s.id}>
                  <label className="flex items-start gap-2 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={selected.includes(s.id)}
                      onChange={() => toggle(s.id)}
                      className="accent-tone-600 mt-1"
                    />
                    <span className="min-w-0">
                      <span className="text-ink-soft">{s.label}</span>
                      <span className="block text-xs text-ink-faint truncate max-w-full">{s.text}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>

          <div className="space-y-1">
            <label htmlFor={`${uid}-scene`} className="block text-xs text-ink-faint">What the picture shows (your words, change them freely)</label>
            <textarea
              id={`${uid}-scene`}
              value={scene}
              maxLength={MAX_SCENE_LENGTH}
              rows={3}
              onChange={(e) => { setScene(e.target.value); setSceneEdited(true); }}
              className={fieldFullClass}
            />
            <p className={`text-[11px] ${wordCount(scene) > SCENE_WORD_LIMIT ? "text-warning-ink" : "text-ink-ghost"}`}>
              {wordCount(scene)} words.{" "}
              {wordCount(scene) > SCENE_WORD_LIMIT
                ? `The image tool mostly reads only the first ${SCENE_WORD_LIMIT} or so, so the rest may be ignored.`
                : "Shorter, plainer scenes usually give clearer pictures."}
              {sceneEdited && (
                <>
                  {" "}
                  <button type="button" onClick={rebuild} className="underline text-ink-faint hover:text-ink-soft">
                    Rebuild from the ticked words
                  </button>
                </>
              )}
            </p>
          </div>

          <SceneIdeas cardId={cardId} onUse={(text) => { setScene(text); setSceneEdited(true); }} />

          <div className="space-y-2">
            <div>
              <p className="text-xs text-ink-faint mb-1">Look (optional): press to add, or type your own below</p>
              <div className="flex flex-wrap gap-1.5">
                {STYLE_PRESETS.map((p) => (
                  <button key={p.id} type="button" onClick={() => addPreset(p.text)} className={`${buttonClass.quiet} ${smallButton}`}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <label htmlFor={`${uid}-style`} className="block text-xs text-ink-faint">
                Style note (for example &ldquo;ink drawing, grey tones, no faces&rdquo;)
              </label>
              <input
                id={`${uid}-style`}
                value={style}
                maxLength={MAX_STYLE_LENGTH}
                onChange={(e) => setStyle(e.target.value)}
                autoComplete="off"
                className={fieldFullClass}
              />
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" disabled={!style.trim() || style.trim() === (deckNote ?? "")} onClick={saveForSet} className={`${buttonClass.quiet} ${smallButton}`}>
                  Save this note as the style for this set
                </button>
                {deckNote && (
                  <button type="button" onClick={clearForSet} className={`${buttonClass.quiet} ${smallButton}`}>
                    Clear this set&rsquo;s saved style
                  </button>
                )}
              </div>
              {deckNote && <p className="text-xs text-ink-faint break-words">Saved for this set: {deckNote}</p>}
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-0 flex-1 basis-40">
                  <label htmlFor={`${uid}-style-name`} className="block text-xs text-ink-faint mb-1">Keep this note in your styles, under the name</label>
                  <input
                    id={`${uid}-style-name`}
                    value={styleName}
                    maxLength={MAX_ART_STYLE_NAME}
                    onChange={(e) => setStyleName(e.target.value)}
                    autoComplete="off"
                    className={fieldFullClass}
                  />
                </div>
                <button type="button" disabled={!style.trim() || !styleName.trim()} onClick={saveNamed} className={`${buttonClass.quiet} ${smallButton}`}>
                  Save to my styles
                </button>
              </div>
              {savedStyles.length > 0 && (
                <div>
                  <p className="text-xs text-ink-faint mb-1">Your styles: press to add one to the note</p>
                  <ul className="flex flex-wrap gap-1.5 list-none p-0">
                    {savedStyles.map((s) => (
                      <li key={s.id} className="inline-flex items-center gap-0.5">
                        <button type="button" onClick={() => addPreset(s.text)} title={s.text} className={`${buttonClass.quiet} ${smallButton}`}>
                          {s.name}
                        </button>
                        <button type="button" onClick={() => removeNamed(s)} aria-label={`Remove the style ${s.name}`} className={`${buttonClass.danger} ${smallButton}`}>
                          <span aria-hidden="true">×</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {styleMessage && <p role={styleMessage.ok ? "status" : "alert"} className={`text-xs ${styleMessage.ok ? "text-ink-faint" : "text-danger"}`}>{styleMessage.text}</p>}
            </div>
            <label className="flex items-start gap-2 cursor-pointer text-sm">
              <input type="checkbox" checked={useComposition} onChange={(e) => setUseComposition(e.target.checked)} className="accent-tone-600 mt-1" />
              <span>
                <span className="text-ink-soft">Shape it like {w.a}</span>
                <span className="block text-xs text-ink-faint">Adds: {compositionFor(form)}</span>
              </span>
            </label>
          </div>

          <div className="rounded-md border border-line bg-surface-sunken p-3 space-y-1">
            <p className="text-xs text-ink-faint">{queued ? "Sent to the picture studio, word for word:" : "Sent to the image tool, word for word:"}</p>
            <p className="text-sm text-ink-soft break-words">{prompt || "(nothing yet)"}</p>
            <p className="text-[11px] text-ink-ghost">
              {promptWords} words. The tool is also told to keep out: {NEGATIVE_PROMPT}. That only avoids lettering and smudges; it adds no
              meaning.{promptWords > SCENE_WORD_LIMIT + 15 ? " This is long; the end may be ignored." : ""}
            </p>
          </div>

          <details className="text-xs text-ink-muted">
            <summary className="cursor-pointer text-ink-faint hover:text-ink-soft">Tips for pictures that look like {w.many}</summary>
            <ul className="mt-2 space-y-1 list-disc pl-5">
              {CARD_TIPS.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </details>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor={`${uid}-count`} className="block text-xs text-ink-faint">How many to make</label>
              <select
                id={`${uid}-count`}
                value={count}
                onChange={(e) => setCount(cleanBatch(Number(e.target.value)))}
                className={`${fieldFullClass} w-24`}
              >
                {Array.from({ length: MAX_BATCH }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            {running ? (
              <button type="button" onClick={stop} className={buttonClass.quiet}>Stop</button>
            ) : (
              <button type="button" onClick={generate} disabled={asking} className={buttonClass.primary}>
                {asking ? "Asking…" : queued ? `Ask for ${count === 1 ? "a picture" : `${count} pictures`}` : `Make ${count === 1 ? "a picture" : `${count} pictures`}`}
              </button>
            )}
            {queued ? (
              activeJobs > 0 && (
                <button type="button" onClick={cancelWaiting} className={buttonClass.quiet}>Cancel the waiting pictures</button>
              )
            ) : (
              <button type="button" onClick={() => check()} disabled={checking || !!running} className={buttonClass.quiet}>
                {checking ? "Checking…" : "Test the connection"}
              </button>
            )}
          </div>

          {queued && (studio || jobs.length > 0) && (
            <div className="text-xs text-ink-muted space-y-1" role="status" aria-live="polite">
              {studio && (
                <p>
                  {studio.awake
                    ? "The picture studio is awake."
                    : `The picture studio is asleep. It runs on ${hostWords}, so pictures wait here until that computer is on and the studio is started. They are kept for 24 hours.`}
                </p>
              )}
              {jobs.length > 0 && (
                <ul className="list-none p-0 m-0 space-y-0.5">
                  {jobs.map((j) => (
                    <li key={j.id}>
                      {j.status === "queued" && <>Waiting for its turn{j.ahead > 0 ? ` (${j.ahead} ahead of it)` : ""}: {j.prompt.slice(0, 60)}{j.prompt.length > 60 ? "…" : ""}</>}
                      {j.status === "running" && <>Being made now: {j.prompt.slice(0, 60)}{j.prompt.length > 60 ? "…" : ""}</>}
                      {j.status === "failed" && (
                        <>
                          <span className="text-danger">Could not be made: {j.error ?? "something went wrong."}</span>{" "}
                          <button type="button" onClick={() => clearFailed(j.id)} className="underline text-ink-faint hover:text-ink-soft">Clear</button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {running && (
            <div className="text-xs text-ink-muted space-y-0.5" role="status">
              <p>
                Making picture {running.done + 1} of {running.total}&hellip; {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")} so far.
              </p>
              <p className="text-ink-faint">
                A small model takes seconds; a large one can take several minutes per picture. Stop ends the wait, but the image tool
                finishes the picture it started, so the next one may wait behind it.
              </p>
            </div>
          )}
        </>
      )}

      {message && (
        <p className={`text-xs ${message.ok ? "text-ink-faint" : "text-danger"}`} role={message.ok ? "status" : "alert"}>
          {message.text}
        </p>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          <div className="space-y-1">
            <label htmlFor={`${uid}-alt`} className="block text-xs text-ink-faint">
              Description for a screen reader. Suggested from your words; change it as you like. It goes with any picture you keep.
            </label>
            <input
              id={`${uid}-alt`}
              value={alt}
              maxLength={MAX_ALT_LENGTH}
              onChange={(e) => { setAlt(e.target.value); setAltEdited(true); }}
              autoComplete="off"
              className={fieldFullClass}
            />
          </div>
          {results.some((r) => r.state === "new") && (
            <div className="space-y-1">
              <label htmlFor={`${uid}-keeptags`} className="block text-xs text-ink-faint">
                Tags for any picture you keep in the gallery (optional; your own words, separated by commas)
              </label>
              <input
                id={`${uid}-keeptags`}
                value={keepTags}
                onChange={(e) => setKeepTags(e.target.value)}
                autoComplete="off"
                className={`${fieldFullClass} max-w-md`}
              />
            </div>
          )}

          <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 list-none p-0 m-0">
            {results.map((r, i) => (
              <li key={r.key} className="space-y-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.src}
                  alt={`Picture ${i + 1}: ${alt || "made from your words"}`}
                  onLoad={(e) => patch(r.key, { size: `${e.currentTarget.naturalWidth} × ${e.currentTarget.naturalHeight}` })}
                  className="w-full h-auto rounded-md border border-line-strong"
                />
                {r.size && <p className="text-[11px] text-ink-ghost">{r.size}{r.enlarged ? " (made larger)" : ""}</p>}
                {r.state === "used" && <p className="text-[11px] text-success-ink">On this item</p>}
                {r.state === "saved" && <p className="text-[11px] text-success-ink">In your gallery</p>}
                {r.state === "busy" && <p className="text-[11px] text-ink-faint">Working&hellip;</p>}
                {(r.state === "new" || r.state === "saved") && (
                  <div className="flex flex-wrap gap-1.5">
                    {confirming === r.key ? (
                      <p className="text-[11px] text-ink-muted">
                        Replace the current picture?{" "}
                        <button type="button" onClick={() => putHere(r)} className="text-danger-ink hover:text-danger-soft underline">Yes, replace</button>{" "}
                        <button type="button" onClick={() => setConfirming(null)} className="text-ink-faint hover:text-ink-soft underline">Keep it</button>
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={() => (hasArt ? setConfirming(r.key) : putHere(r))}
                        className={`${buttonClass.primary} ${smallButton}`}
                      >
                        Use here
                      </button>
                    )}
                    {r.state === "new" && (
                      <button type="button" onClick={() => keepInGallery(r)} className={`${buttonClass.quiet} ${smallButton}`}>
                        Keep in gallery
                      </button>
                    )}
                    {canEnlarge && !r.enlarged && !running &&
                      ENLARGE_FACTORS.map((f) => (
                        <button key={f} type="button" onClick={() => enlarge(r, f)} className={`${buttonClass.quiet} ${smallButton}`}>
                          Make larger &times;{f}
                        </button>
                      ))}
                    <button type="button" onClick={() => discard(r.key)} className={`${buttonClass.text} !px-1 !py-1 !text-xs`}>
                      {r.state === "saved" ? "Clear" : "Discard"}
                    </button>
                  </div>
                )}
                {r.state === "used" && (
                  <button type="button" onClick={() => discard(r.key)} className={`${buttonClass.text} !px-1 !py-1 !text-xs`}>Clear</button>
                )}
              </li>
            ))}
          </ul>

          {canEnlarge === false && (
            <p className="text-xs text-ink-faint">
              &ldquo;Make larger&rdquo; needs an upscaler model in your image tool. In KoboldCpp, add one in the Image Gen tab (Upscaler), start it
              again, and press &ldquo;Test the connection&rdquo;. Bigger pictures come from enlarging, not from asking for a larger size, which is
              very slow on most graphics cards.
              {onDisk ? "" : " Enlarged pictures need more room than the database allows, so they are shrunk when saved here."}
            </p>
          )}
          <p className="text-[11px] text-ink-ghost">
            Pictures you do not keep disappear when you leave this page. Kept ones are in your{" "}
            <Link href="/oracle/gallery" className="underline">gallery</Link>.
          </p>
        </div>
      )}
    </section>
  );
}
