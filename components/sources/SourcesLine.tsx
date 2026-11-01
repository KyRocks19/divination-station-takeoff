import Link from "next/link";
import { TOOL_GUIDES, getSource, sourcesPath, type ToolGuideId } from "@/lib/sources";

/** A line at the foot of a tool's page that names where to read more and opens the full bibliography. */
export default function SourcesLine({ tool }: { tool: ToolGuideId }) {
  const names = TOOL_GUIDES[tool].start
    .map(getSource)
    .filter((s) => !!s)
    .map((s) => s!.short);
  return (
    <p className="text-xs text-ink-faint leading-relaxed">
      Where this comes from and what is only conjecture: {names.join(", ")}.{" "}
      <Link href={sourcesPath(tool)} className="underline hover:text-accent-ink">
        The full bibliography
      </Link>
    </p>
  );
}
