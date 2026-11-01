import type { Metadata } from "next";

// The page is a client component and cannot set its own title, so its layout does (shown in the tab and read out by screen readers).
export const metadata: Metadata = { title: "Edit post" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
