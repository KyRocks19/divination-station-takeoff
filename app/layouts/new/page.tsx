import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import LayoutEditor from "@/components/layouts/LayoutEditor";
import { blankPosition } from "@/lib/layouts-shared";
import { BackLink, Page, PageTitle } from "@/components/ui/Page";

export default async function NewLayoutPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");

  return (
    <Page>
      <BackLink href="/layouts">
        ← Your layouts
      </BackLink>
      <PageTitle>Make a layout</PageTitle>
      <LayoutEditor initial={{ id: null, name: "", description: "", question: "", positions: [blankPosition()] }} />
    </Page>
  );
}

export const metadata = { title: "New layout" };
