"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// "Today" is the person's own calendar date, which only their browser knows, so this page opens today's day from there.
export default function TodayPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/days/${new Date().toLocaleDateString("en-CA")}`);
  }, [router]);
  return <p role="status" className="max-w-page mx-auto px-4 py-10 text-sm text-ink-ghost">Opening today…</p>;
}
