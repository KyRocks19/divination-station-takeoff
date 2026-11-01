"use client";

import ReadingShell from "@/components/tools/ReadingShell";
import { NOTE_WORDS } from "@/lib/signs-core";
import type { SignNote } from "@/lib/signs";
import type { DivinationEntry } from "@/lib/divinations";
import type { Sky } from "@/lib/sky";
import { revealSpec } from "@/lib/reveal-core";

interface Props {
  initialReading: SignNote;
  initialEntries: DivinationEntry[];
  sky: Sky & { recorded: boolean };
}

/** One saved note of a sign or a dream, with what the person wrote about it later. */
export default function NoteView({ initialReading, initialEntries, sky }: Props) {
  const note = initialReading;
  const words = NOTE_WORDS[note.note_type];
  return (
    <ReadingShell
      reveal={revealSpec("signs")}
      reading={note}
      initialEntries={initialEntries}
      sky={sky}
      api={`/api/signs/${note.id}`}
      listHref="/signs"
      listLabel="Signs and dreams"
      madeWord="Written"
      noun="note"
      journalPrompt="What do you make of this, and what followed?"
      journalHint="You can come back to this later and write what happened. Reading your own words beside what followed is how your sense of your own signs sharpens."
      footerLinks={[
        { href: "/signs/new", label: "Note another" },
        { href: "/signs", label: "All notes" },
      ]}
      toolName="Signs and dreams"
      shareLines={[`${words.label}: ${note.body}`]}
      deleteNote="Delete this note and what you wrote about it?"
    >
      <section aria-label={words.label} className="space-y-2">
        <p className="text-[11px] text-tone-400 uppercase tracking-widest">
          {words.label}
          {note.happened_on && (
            <>
              {" · on "}
              <time dateTime={note.happened_on}>{note.happened_on}</time>
            </>
          )}
        </p>
        <p className="text-base text-ink-strong leading-relaxed whitespace-pre-wrap break-words">{note.body}</p>
      </section>
    </ReadingShell>
  );
}
