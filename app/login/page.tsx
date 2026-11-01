import { Suspense } from "react";
import LoginForm from "@/components/LoginForm";
import { shapeOf } from "@/lib/edition";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm showJoin={shapeOf() !== "local"} />
    </Suspense>
  );
}
