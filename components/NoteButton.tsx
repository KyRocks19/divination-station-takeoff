"use client";

const SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Frequency in Hz for a name like "E Natural" or "G Sharp", in the octave above middle C. */
function frequencyOf(note: string): number | null {
  const [letter, accidental] = note.trim().split(/\s+/);
  const base = SEMITONES[letter?.toUpperCase()];
  if (base === undefined) return null;
  const semitone = base + (accidental?.toLowerCase() === "sharp" ? 1 : accidental?.toLowerCase() === "flat" ? -1 : 0);
  return 261.63 * Math.pow(2, semitone / 12);
}

/** Play one or more notes in sequence, each for a little over a second. */
export function playNotes(notes: string[]) {
  const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) return;
  const ctx = new AudioCtor();
  const step = 0.9;
  notes.forEach((note, i) => {
    const frequency = frequencyOf(note);
    if (!frequency) return;
    const start = ctx.currentTime + i * step;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.25, start + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 1.2);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 1.25);
  });
  setTimeout(() => ctx.close(), (notes.length * step + 1.5) * 1000);
}

export default function NoteButton({ notes, label, className = "" }: { notes: string[]; label: string; className?: string }) {
  if (notes.length === 0) return null;
  return (
    <button
      type="button"
      onClick={() => playNotes(notes)}
      className={`text-[11px] text-accent-ink hover:text-accent-ink-hover border border-line-strong hover:border-line-hover rounded px-2 py-0.5 transition-colors ${className}`}
    >
      <span aria-hidden="true">♪ </span>{label}
    </button>
  );
}
