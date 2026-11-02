import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { aiReadyFor } from "@/lib/ai-ready";

// The page is a client component and cannot set its own title, so its layout does (shown in the tab and read out by screen readers).
export const metadata: Metadata = { title: "New journal entry" };

export default async function Layout({ children }: { children: React.ReactNode }) {
  // A new entry here is written with Claude: without a Claude key that works the page is not there at all (lib/ai-ready-core.ts).
  const session = await getSession();
  if (!(await aiReadyFor(session.userId)).claude) notFound();
  return children;
}
