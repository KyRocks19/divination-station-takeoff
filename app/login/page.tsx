import { Suspense } from "react";
import LoginForm from "@/components/LoginForm";
import { shapeOf } from "@/lib/edition";
import { hostedFolderEmpty } from "@/lib/local-setup";

export default async function LoginPage() {
  // A hosted copy whose data folder has no accounts cannot be signed in to; say so instead of letting every password fail (lib/local-setup.ts).
  const emptyFolder = await hostedFolderEmpty();
  return (
    <Suspense>
      <LoginForm showJoin={shapeOf() !== "local"} emptyFolder={emptyFolder} />
    </Suspense>
  );
}
