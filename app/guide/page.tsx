import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { TOUR_STEPS } from "@/lib/tour-steps";
import { BackLink, Page, PageTitle } from "@/components/ui/Page";

export const metadata = { title: "How this works" };

// The same steps as the first-run tour, as a page to open whenever it is wanted. "Show the tour again" opens the home page with the tour on it.
export default async function GuidePage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");

  return (
    <Page>
      <BackLink href="/">← Home</BackLink>
      <PageTitle>How this works</PageTitle>
      <ol className="space-y-5">
        {TOUR_STEPS.map((s, i) => (
          <li key={s.title} className="space-y-1">
            <h2 className="font-semibold text-ink-strong">{i + 1}. {s.title}</h2>
            <p className="text-sm text-ink-soft leading-relaxed">{s.body}</p>
            {s.link && <p className="text-sm"><Link href={s.link.href} className="text-tone-400 underline">{s.link.label}</Link></p>}
          </li>
        ))}
      </ol>
      <p className="text-sm text-ink-muted">
        <Link href="/?tour=1" className="underline">Show the tour again on the home page</Link>
        {" · "}
        <Link href="/guide/circles" className="underline">Circles and Tailscale</Link>
      </p>
    </Page>
  );
}
