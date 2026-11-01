import { SHARING_NOTICE, sharingPoints } from "@/lib/circles-core";

/**
 * What goes where when a person is in a circle (open item C5). Shown before joining, and again on the Circle page, so the words are the same in
 * both places. The words live in lib/circles-core.ts and are tested there.
 */
export default function SharingNotice({ headingId, Heading = "h3", host = false }: { headingId: string; Heading?: "h2" | "h3"; host?: boolean }) {
  return (
    <div className="space-y-2 bg-field border border-line-strong rounded-control p-3">
      <Heading id={headingId} className="text-sm text-ink-strong font-medium">{SHARING_NOTICE.title}</Heading>
      <ul aria-labelledby={headingId} className="list-disc pl-5 space-y-1 text-xs text-ink-soft">
        {sharingPoints(host).map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
    </div>
  );
}
