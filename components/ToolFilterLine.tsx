import Link from "next/link";
import { showEverythingCount, toolFilterHref, toolNames, type DivinationKind } from "@/lib/divination-kinds";

interface Props {
  /** The person's saved choice of tools. Null means every tool, and then nothing is shown. */
  tools: DivinationKind[] | null;
  /** True when this page was widened to every tool with "Show everything". */
  widened: boolean;
  /** This page's path, for example "/readings". */
  path: string;
  /** The page's other query parameters, kept when a link is pressed. */
  keep?: Record<string, string | undefined>;
  /** How many things (readings, entries) the saved choice is leaving out of this page. Left out, no number is shown. */
  hidden?: number;
  /** What the number counts, when it is not the page's own list of things: "tools" or "readings". */
  noun?: keyof typeof NOUNS;
}

const NOUNS = {
  tools: { one: "tool", many: "tools" },
  readings: { one: "reading", many: "readings" },
};

/**
 * Says which tools a page is listing when the person's saved choice is narrower than every tool, with a link
 * that widens this one page. The saved choice itself is changed with the stars on the home page's tool tiles.
 */
export default function ToolFilterLine({ tools, widened, path, keep, hidden, noun }: Props) {
  if (tools === null) return null;
  const link = "text-tone-400 hover:text-tone-300 underline underline-offset-2";
  return (
    <p className="text-xs text-ink-faint">
      {widened ? (
        <>
          Showing everything. Your tools: {toolNames(tools)}.{" "}
          <Link href={toolFilterHref(path, false, keep)} className={link}>
            Show only your tools
          </Link>
        </>
      ) : (
        <>
          Showing: {toolNames(tools)}.{" "}
          <Link href={toolFilterHref(path, true, keep)} className={link}>
            Show everything{showEverythingCount(hidden, noun ? NOUNS[noun] : undefined)}
          </Link>
        </>
      )}
    </p>
  );
}
