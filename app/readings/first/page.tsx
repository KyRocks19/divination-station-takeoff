import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import FirstReading from "@/components/FirstReading";
import { BackLink, Page, PageTitle } from "@/components/ui/Page";

// A guided first reading: one card and three short questions, for someone who has not done a reading here before.
export default async function FirstReadingPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");

  return (
    <Page>
      <BackLink href="/readings">← Readings</BackLink>
      <PageTitle>Your first reading</PageTitle>
      <FirstReading />
    </Page>
  );
}

export const metadata = { title: "Your first reading" };
