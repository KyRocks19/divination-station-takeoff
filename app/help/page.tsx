import Link from "next/link";
import { Page, PageTitle } from "@/components/ui/Page";
import { CRISIS_LINES } from "@/lib/crisis-lines";

// "If you are struggling": linked from the footer of every page and from About. Public on purpose (PUBLIC_PATHS in proxy.ts), so
// it is there before sign-in and for every age: the companion, the other place these lines appear, is only for people over 18.
// Draft wording for the owner's wording pass; the crisis sentence itself is shared with the privacy text (lib/crisis-lines.ts).
export default function HelpPage() {
  return (
    <Page>
      <PageTitle>If you are struggling</PageTitle>
      <p className="text-sm text-ink-muted leading-relaxed">{CRISIS_LINES}</p>
      <p className="text-sm text-ink-muted leading-relaxed">
        Divination Station is a place to write and to practise. It is not crisis support, and nothing in it is medical, legal or
        financial advice. Talking to someone you trust, a doctor or a counsellor can help with what a reading brings up.
      </p>
      <p className="text-sm text-ink-muted leading-relaxed">
        <a href="https://findahelpline.com" rel="noopener noreferrer" className="text-accent-ink hover:text-accent-ink-hover underline">
          findahelpline.com
        </a>{" "}
        lists free, confidential lines by country, including ones for young people.
      </p>
      <p className="text-sm text-ink-muted leading-relaxed">
        If you need to hide the app quickly, press <strong>Hide</strong> at the top right, or press Esc twice. It shows a small game in
        its place and signs you out, so the Back button does not bring your writing back. Text you have not saved yet is lost.
      </p>
      <p className="text-sm text-ink-muted">
        <Link href="/"className="text-accent-ink hover:text-accent-ink-hover underline">Home</Link>
      </p>
    </Page>
  );
}

export const metadata = { title: "If you are struggling" };
