import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { needsSetup } from "@/lib/local-setup";

// The page is a client component and cannot set its own title, so its layout does (shown in the tab and read out by screen readers).
export const metadata: Metadata = { title: "Sign in" };

export default async function Layout({ children }: { children: React.ReactNode }) {
  // A local copy with no account yet has nothing to sign in to: its first screen is the set-up (lib/local-setup.ts).
  if (await needsSetup()) redirect("/setup");
  return children;
}
