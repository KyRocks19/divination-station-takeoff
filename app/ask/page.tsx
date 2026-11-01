import { BackLink } from "@/components/ui/Page";
import { AskContent } from "@/components/AskContent";
import { hiddenIn } from "@/lib/edition-features";

export default function AskClaudePage() {
  return (
    <div className="max-w-page mx-auto px-4 py-6">
      <BackLink href="/">
        ← Home
      </BackLink>
      <AskContent forum={!hiddenIn(process.env.DS_EDITION, "/forum")} />
    </div>
  );
}
