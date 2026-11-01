"use client";

import { useEffect, useState } from "react";
import DayView from "@/components/DayView";

/** Today's page, as the first section of the Days page. Today is the person's own calendar date, which only their browser knows, so it opens after the first draw. */
export default function TodayOnHub({ letters }: { letters: boolean }) {
  const [day, setDay] = useState<string | null>(null);
  useEffect(() => setDay(new Date().toLocaleDateString("en-CA")), []);
  if (!day) return <p role="status" className="text-sm text-ink-ghost">Opening today…</p>;
  return <DayView day={day} embedded letters={letters} />;
}
