import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { toId } from "@/lib/oracle";
import { loadLayout } from "@/lib/layouts";
import LayoutEditor from "@/components/layouts/LayoutEditor";
import { BackLink, Page, PageTitle } from "@/components/ui/Page";

export default async function LayoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session.userId) redirect("/login");

  const layout = await loadLayout(session.userId, toId(id));
  if (!layout) {
    return (
      <div className="max-w-page mx-auto px-4 py-8 space-y-3">
        <p className="text-ink-faint">Layout not found.</p>
        <BackLink href="/layouts">
          ← Your layouts
        </BackLink>
      </div>
    );
  }

  return (
    <Page>
      <BackLink href="/layouts">
        ← Your layouts
      </BackLink>
      <PageTitle>{layout.name}</PageTitle>
      <LayoutEditor
        initial={{
          id: layout.id,
          name: layout.name,
          description: layout.description ?? "",
          question: layout.question ?? "",
          positions: layout.positions.map((p) => ({ name: p.name, prompt: p.prompt ?? "", color: p.color ?? "", x: p.x, y: p.y, rotation: p.rotation })),
        }}
      />
    </Page>
  );
}

export const metadata = { title: "Layout" };
