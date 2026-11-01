import Link from "next/link";
import { cx } from "@/lib/cx";

type TileProps = Omit<React.ComponentProps<typeof Link>, "children"> & {
  /** The small picture above the label. Decoration: a screen reader skips it and reads the label. */
  icon: React.ReactNode;
  label: string;
  /** One short line under the label. */
  note?: string;
  /** How many there are (readings, journals), shown in the tile's corner and read after the label. */
  count?: number;
};

/** A square-ish link with a picture, a name, and optionally one line and a number: the tiles on the home page. */
export function Tile({ icon, label, note, count, className, ...rest }: TileProps) {
  return (
    <Link
      className={cx(
        "relative bg-tone-700/20 border border-line-strong rounded-card p-4 text-center hover:bg-tone-700/30 transition-colors",
        className
      )}
      {...rest}
    >
      <div aria-hidden="true" className="text-2xl mb-1">{icon}</div>
      <div className="text-sm text-tone-300">{label}</div>
      {note && <div className="text-[11px] text-ink-faint mt-0.5">{note}</div>}
      {count !== undefined && (
        <div className="absolute top-2 right-2 min-w-6 rounded-full border border-line px-1.5 text-xs font-semibold text-tone-300">
          <span className="sr-only">, </span>
          {count}
        </div>
      )}
    </Link>
  );
}
