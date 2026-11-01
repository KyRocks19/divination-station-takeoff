"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { buttonClass } from "@/components/ui/Button";
import { fieldFullClass } from "@/components/ui/Field";
import { SectionLabel } from "@/components/ui/Page";
import DrawingBoard from "@/components/oracle/DrawingBoard";
import ItemArt from "@/components/oracle/ItemArt";
import GalleryPicker from "@/components/oracle/GalleryPicker";
import { formWords } from "@/lib/oracle-forms";
import { MADE_WITH_LABELS } from "@/lib/art-maker";
import { shrinkImage, svgToPngBlob } from "@/lib/oracle-art-client";
import { MAX_ALT_LENGTH, limitsFor, type Drawing } from "@/lib/oracle-art";
import type { OracleArt } from "@/lib/oracle";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

interface Props {
  cardId: number;
  form: string;
  art: OracleArt | null;
  /** Whether pictures are kept as files on disk, which allows larger pictures. */
  onDisk: boolean;
  /** Called after the picture changed, so the page can read the card again. */
  onChanged: () => void | Promise<void>;
}

/** The picture section of an item's page: draw one, upload one, change or remove it, and describe it in words. */
export default function ArtEditor({ cardId, form, art, onDisk, onChanged }: Props) {
  const uid = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const w = formWords(form);
  const [mode, setMode] = useState<"view" | "draw" | "gallery">("view");
  const [alt, setAlt] = useState(art?.alt ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  // Tags for a copy kept in the gallery, typed as one line; the gallery page is where tags are changed afterwards.
  const [keepTags, setKeepTags] = useState("");

  // When the picture changes (here, or from the gallery or the picture-maker), the description box shows the new one.
  // The "saved" note is kept on purpose, so the person sees that the change went through.
  useEffect(() => {
    setAlt(art?.alt ?? "");
  }, [art?.version, art?.alt]);

  async function put(body: unknown, failure: string): Promise<boolean> {
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const res = await fetch(`/api/oracle/cards/${cardId}/art`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => null);
        throw new Error(typeof b?.error === "string" ? b.error : failure);
      }
      await onChanged();
      return true;
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : failure);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveDrawing(drawing: Drawing) {
    if (await put({ kind: "drawing", drawing, alt }, "Could not save the drawing. It is still on the board; try again.")) {
      setMode("view");
      setSaved("Drawing saved.");
    }
  }

  async function chooseFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      setError("Use a JPEG, PNG, or WebP picture. Other kinds, including SVG and GIF, are not accepted.");
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(null);
    let image: string;
    try {
      image = await shrinkImage(file, limitsFor(onDisk));
    } catch {
      setBusy(false);
      setError("That picture could not be read or made small enough. Try a different one.");
      return;
    }
    setBusy(false);
    if (await put({ kind: "upload", image, alt }, "Could not save the picture. Nothing was changed; try again.")) {
      setSaved("Picture saved.");
    }
  }

  async function chooseFromGallery(galleryId: number) {
    if (await put({ kind: "gallery", gallery_id: galleryId }, "Could not use that picture. Nothing was changed; try again.")) {
      setMode("view");
      setSaved("Picture saved from your gallery.");
    }
  }

  async function saveToGallery() {
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const res = await fetch("/api/oracle/gallery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from_card: cardId, tags: keepTags }),
      });
      const b = await res.json().catch(() => null);
      if (!res.ok) throw new Error(typeof b?.error === "string" ? b.error : "Could not save it to the gallery.");
      setSaved("A copy is in your gallery.");
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Could not save it to the gallery.");
    } finally {
      setBusy(false);
    }
  }

  // A drawing is strokes, not a picture file, so the browser draws it to a picture first and sends that, like an upload. Nothing leaves the app's own server.
  async function saveDrawingToGallery() {
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const svg = await fetch(`/api/oracle/cards/${cardId}/art`);
      if (!svg.ok) throw new Error("The drawing could not be read. Try again in a moment.");
      const png = await svgToPngBlob(await svg.text());
      let image: string;
      try {
        image = await shrinkImage(png, limitsFor(onDisk));
      } catch {
        throw new Error("The drawing could not be made small enough to keep.");
      }
      const res = await fetch("/api/oracle/gallery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, alt: art?.alt ?? undefined, tags: keepTags }),
      });
      const b = await res.json().catch(() => null);
      if (!res.ok) throw new Error(typeof b?.error === "string" ? b.error : "Could not save it to the gallery.");
      setSaved("A copy of the drawing, as a picture, is in your gallery. The drawing stays here.");
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Could not save it to the gallery.");
    } finally {
      setBusy(false);
    }
  }

  async function removeNote() {
    if (await put({ made_with: null }, "Could not remove the note. Nothing was changed.")) setSaved("Note removed.");
  }

  async function saveAlt(e: React.FormEvent) {
    e.preventDefault();
    if (!art) return;
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const res = await fetch(`/api/oracle/cards/${cardId}/art`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alt }),
      });
      if (!res.ok) throw new Error();
      setSaved("Description saved.");
      await onChanged();
    } catch {
      setError("Could not save the description. Your text is still here; try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const res = await fetch(`/api/oracle/cards/${cardId}/art`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setConfirmRemove(false);
      setAlt("");
      await onChanged();
    } catch {
      setError("Could not remove the picture. Nothing was changed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby={`${uid}-art`} className="bg-surface border border-line rounded-card p-5 space-y-4">
      <SectionLabel id={`${uid}-art`}>Picture</SectionLabel>

      {mode === "draw" ? (
        <DrawingBoard
          form={form}
          initial={art?.drawing ?? null}
          saving={busy}
          onSave={saveDrawing}
          onCancel={() => { setMode("view"); setError(null); }}
        />
      ) : mode === "gallery" ? (
        <GalleryPicker busy={busy} onChoose={chooseFromGallery} onCancel={() => setMode("view")} />
      ) : (
        <div className="space-y-3">
          {art ? (
            <ItemArt cardId={cardId} version={art.version} alt={art.alt} form={form} height={200} />
          ) : (
            <p className="text-sm text-ink-faint">
              No picture yet. A picture is optional: draw one here, upload one of your own, or choose one from your{" "}
              <Link href="/oracle/gallery" className="underline">gallery</Link>. You can change or remove it whenever you like.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={busy} onClick={() => setMode("draw")} className={buttonClass.primary}>
              {art?.kind === "drawing" ? "Change the drawing" : art ? "Draw one instead" : `Draw ${w.a}`}
            </button>
            <button type="button" disabled={busy} onClick={() => fileInput.current?.click()} className={buttonClass.quiet}>
              {art?.kind === "upload" ? "Upload a different picture" : art ? "Upload one instead" : "Upload a picture"}
            </button>
            <button type="button" disabled={busy} onClick={() => setMode("gallery")} className={buttonClass.quiet}>
              Choose from your gallery
            </button>
            {art?.kind === "upload" && (
              <button type="button" disabled={busy} onClick={saveToGallery} className={buttonClass.quiet}>
                Keep a copy in the gallery
              </button>
            )}
            {art?.kind === "drawing" && !art.offline && (
              <button type="button" disabled={busy} onClick={saveDrawingToGallery} className={buttonClass.quiet}>
                Keep the drawing in the gallery as a picture
              </button>
            )}
            {art && !art.offline && (
              <a href={`/api/oracle/cards/${cardId}/art?download=1`} className={`${buttonClass.quiet} inline-flex items-center`}>
                Download the picture
              </a>
            )}
            <input ref={fileInput} type="file" accept={ACCEPTED.join(",")} onChange={chooseFile} className="sr-only" tabIndex={-1} aria-hidden="true" />
            {art && !confirmRemove && (
              <button type="button" disabled={busy} onClick={() => setConfirmRemove(true)} className={buttonClass.danger}>
                Remove the picture
              </button>
            )}
          </div>
          {(art?.kind === "upload" || (art?.kind === "drawing" && !art.offline)) && (
            <div>
              <label htmlFor={`${uid}-keeptags`} className="block text-xs text-ink-faint mb-1">
                Tags for the copy in the gallery (optional; your own words, separated by commas)
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
          {art?.offline && (
            <p className="text-xs text-ink-muted">
              This picture is a file on the owner&rsquo;s computer, which cannot be reached from here right now. It is not lost: it shows
              again when that computer is on.
            </p>
          )}
          {art?.made_with && MADE_WITH_LABELS[art.made_with] && (
            <p className="text-xs text-ink-faint">
              {MADE_WITH_LABELS[art.made_with]}.{" "}
              <button type="button" onClick={removeNote} disabled={busy} className="text-ink-muted hover:text-ink-soft underline">
                Remove this note
              </button>
            </p>
          )}
          {confirmRemove && (
            <p className="text-xs text-ink-muted">
              Remove this picture? The {w.one}&rsquo;s name and words stay. This cannot be undone.{" "}
              <button type="button" onClick={remove} disabled={busy} className="text-danger-ink hover:text-danger-soft">
                {busy ? "Removing…" : "Yes, remove it"}
              </button>{" "}
              <button type="button" onClick={() => setConfirmRemove(false)} className="text-ink-faint hover:text-ink-soft">
                Keep it
              </button>
            </p>
          )}

          {art && (
            <form onSubmit={saveAlt} className="space-y-1">
              <label htmlFor={`${uid}-alt`} className="block text-xs text-ink-faint">
                Describe the picture in a few words (read aloud by a screen reader; optional)
              </label>
              <div className="flex gap-2">
                <input
                  id={`${uid}-alt`}
                  value={alt}
                  maxLength={MAX_ALT_LENGTH}
                  onChange={(e) => { setAlt(e.target.value); setSaved(null); }}
                  autoComplete="off"
                  className={`${fieldFullClass} flex-1 min-w-0`}
                />
                <button type="submit" disabled={busy || alt.trim() === (art.alt ?? "")} className={buttonClass.quiet}>
                  Save
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {saved && <p className="text-xs text-ink-faint" role="status">{saved}</p>}
      {error && <p className="text-xs text-danger" role="alert">{error}</p>}
    </section>
  );
}
