"use client";

import { useEffect } from "react";
import { FEATHERED } from "@/lib/edition";

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // The Feathered edition keeps nothing in the browser (docs/plan-feathered-edition.md, 4.3): no worker, and one left by an earlier copy is removed.
    if (FEATHERED) {
      navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => void r.unregister())).catch(() => {});
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch(console.error);
  }, []);
  return null;
}
