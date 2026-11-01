import { redirect } from "next/navigation";

// Spreads became layouts: every position a person reads with now lives in /layouts, for tarot and every other tool.
export default function SpreadsPage() {
  redirect("/layouts");
}

export const metadata = { title: "Spreads" };
