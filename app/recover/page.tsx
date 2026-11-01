import RecoverForm from "@/components/RecoverForm";

// Public on purpose (see PUBLIC_PATHS in proxy.ts): a person who cannot sign in sets a new password here with a recovery code.
export const metadata = { title: "Recover your account" };

export default function RecoverPage() {
  return <RecoverForm />;
}
