import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { isValidDay } from "@/lib/days-core";
import DayView from "@/components/DayView";
import { hiddenIn } from "@/lib/edition-features";

// One day's page. The date in the address is the person's own calendar date (YYYY-MM-DD).
export default async function DayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const session = await getSession();
  if (!session.userId) redirect("/login");
  if (!isValidDay(date)) notFound();
  return <DayView day={date} letters={!hiddenIn(process.env.DS_EDITION, "/letters")} />;
}

export async function generateMetadata({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  return { title: isValidDay(date) ? date : "A day" };
}
