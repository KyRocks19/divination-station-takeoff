import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { listAll, listOwn } from "@/lib/feedback";
import { Page, PageTitle, SectionLabel } from "@/components/ui/Page";
import FeedbackForm from "@/components/FeedbackForm";
import FeedbackList from "@/components/FeedbackList";

export const metadata = { title: "Feedback" };

export default async function FeedbackPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login?from=/feedback");
  const [own, all] = await Promise.all([listOwn(session.userId), session.isAdmin ? listAll() : Promise.resolve(null)]);

  return (
    <Page>
      <PageTitle>Feedback</PageTitle>
      <p className="text-sm text-ink-muted max-w-prose">
        Something broken, an idea, something that made you stop and wonder what it meant: tell the person who runs this app. Your
        notes are private to you and to them. Please leave out private journal words.
      </p>

      <section aria-labelledby="send" className="bg-surface border border-line rounded-card p-5 space-y-3 max-w-xl">
        <SectionLabel id="send">Send a note</SectionLabel>
        <FeedbackForm />
      </section>

      <section aria-labelledby="mine" className="space-y-3">
        <SectionLabel id="mine">What you have sent</SectionLabel>
        <FeedbackList initial={JSON.parse(JSON.stringify(own))} mode="own" />
      </section>

      {all && (
        <section aria-labelledby="everyone" className="space-y-3">
          <SectionLabel id="everyone">Everyone&rsquo;s notes (only you can see this)</SectionLabel>
          <FeedbackList initial={JSON.parse(JSON.stringify(all))} mode="admin" />
        </section>
      )}
    </Page>
  );
}
