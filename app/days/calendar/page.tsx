import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { isValidMonth } from "@/lib/calendar-core";

// The calendar now lives on the Days page itself (owner's request, 2026-10-30). This address is kept so older links still arrive there, at the same month.
export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const session = await getSession();
  if (!session.userId) redirect("/login");
  const { m } = await searchParams;
  redirect(isValidMonth(m) ? `/days?m=${m}#calendar` : "/days#calendar");
}
