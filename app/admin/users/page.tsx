import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { BackLink, Page, PageTitle } from "@/components/ui/Page";
import UserManagement from "@/components/admin/UserManagement";

// The owner's list of accounts: add, switch off, set limits, reset a password, delete, and make invite codes.
// Only an admin sees it (the API checks too).
export default async function UsersPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");
  if (!session.isAdmin) redirect("/settings");

  return (
    <Page>
      <BackLink href="/settings">← Settings</BackLink>
      <PageTitle>Users</PageTitle>
      <UserManagement me={session.username ?? ""} />
    </Page>
  );
}

export const metadata = { title: "Manage people" };
