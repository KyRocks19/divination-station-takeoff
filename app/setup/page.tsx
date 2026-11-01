import { notFound, redirect } from "next/navigation";
import SetupForm from "@/components/SetupForm";
import { localDbDir } from "@/lib/local-db-core";
import { needsSetup } from "@/lib/local-setup";
import { FEATHERED } from "@/lib/edition";
import { computerDataDir, dataPlace } from "@/lib/data-place";

// Public on purpose (see PUBLIC_PATHS in proxy.ts): the first screen of a copy that keeps its data in a folder on the computer. It does not exist on
// a hosted copy, and once the account is made it sends everyone to the sign-in page.
export const metadata = { title: "Set up" };

export default async function SetupPage() {
  if (!localDbDir()) notFound();
  if (!(await needsSetup())) redirect("/login");
  // A Feathered copy started from a portable folder can keep its data on the drive or on this computer (lib/data-place.ts).
  return <SetupForm offerLock={FEATHERED} computerFolder={FEATHERED && dataPlace() === "drive" ? computerDataDir() : null} />;
}
