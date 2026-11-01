import Link from "next/link";
import { citesFor, homeToolOf, sourcesPath, type ToolGuideId } from "@/lib/sources";

interface Props {
  /** A key from `CITES` in lib/sources.ts, for example "runes.futhark". */
  topic: string;
  /** The tool whose bibliography the markers should open, when a source is listed under more than one. */
  tool?: ToolGuideId;
  className?: string;
}

/**
 * "Read more: Page 1987; MacLeod and Mees 2006". Each name opens that source's place in the tool's bibliography. A marker
 * means the source treats the topic, not that a given page proves the sentence above it.
 */
export default function Cite({ topic, tool, className }: Props) {
  const sources = citesFor(topic);
  if (sources.length === 0) return null;
  return (
    <p className={className ?? "text-[11px] text-ink-faint leading-relaxed"}>
      Read more:{" "}
      {sources.map((s, i) => (
        <span key={s.id}>
          {i > 0 && "; "}
          <Link href={sourcesPath(homeToolOf(s.id, tool), s.id)} className="underline hover:text-accent-ink">
            {s.short}
          </Link>
        </span>
      ))}
    </p>
  );
}
