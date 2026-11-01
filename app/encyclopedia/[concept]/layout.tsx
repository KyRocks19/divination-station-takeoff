import type { Metadata } from "next";


// The page is a client component and cannot set its own title, so its layout does (shown in the tab and read out by screen readers).
export async function generateMetadata({ params }: { params: Promise<{ concept: string }> }): Promise<Metadata> {
  const { concept } = await params;
  let name = concept;
  try {
    name = decodeURIComponent(concept);
  } catch {
    // keep the raw text
  }
  return { title: name ? `${name.charAt(0).toUpperCase()}${name.slice(1)} (concept)` : "Concept" };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
