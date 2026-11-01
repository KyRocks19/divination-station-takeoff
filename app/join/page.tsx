import JoinForm from "@/components/JoinForm";
import { familyGateRequired } from "@/lib/family-access-core";
import { isHostMode } from "@/lib/edition";

// Public on purpose (see PUBLIC_PATHS in proxy.ts): a person with an invite code makes their own account here.
export const metadata = { title: "Join" };

export default function JoinPage() {
  return <JoinForm circleOnly={familyGateRequired()} host={isHostMode()} />;
}
