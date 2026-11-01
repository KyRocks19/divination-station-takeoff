import type { Metadata } from "next";
import { getSession } from "@/lib/session";
import { queryOne } from "@/lib/db";

// The page is a client component and cannot set its own title, so its layout does (shown in the tab and read out by screen readers).
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const session = await getSession();
  const n = Number(id);
  if (!session.userId || !Number.isInteger(n)) return { title: "Reading" };
  const row = await queryOne<{ title: string | null; spread_name: string }>("SELECT title, spread_name FROM readings WHERE id = $1 AND user_id = $2", [n, session.userId]).catch(() => null);
  return { title: row ? row.title?.trim() || `${row.spread_name} reading` : "Reading" };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
