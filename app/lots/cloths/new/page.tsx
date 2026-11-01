import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import ClothEditor from "@/components/cloth/ClothEditor";
import ExampleCloths from "@/components/cloth/ExampleCloths";
import { BackLink, Page, PageTitle } from "@/components/ui/Page";

export default async function NewClothPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");
  return (
    <Page>
      <BackLink href="/lots">← Tossing lots</BackLink>
      <PageTitle>Make a cloth</PageTitle>
      <p className="text-sm text-ink-muted leading-relaxed">
        A cloth is a square you throw items onto, such as runes, ogham staves, dice, coins, oracle items or tarot cards. You draw zones on it and name them. After a throw, you say
        which zone each item landed in, or the app can throw the items for you. The app gives no zone a meaning.
      </p>
      <ExampleCloths />
      <ClothEditor />
    </Page>
  );
}

export const metadata = { title: "Make a cloth" };
