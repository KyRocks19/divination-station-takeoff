import { redirect } from "next/navigation";

// Cloths moved to Tossing lots on 2026-10-31; an old link or a Recent page still lands in the right place.
export default function OldNewClothPage() {
  redirect("/lots/cloths/new");
}
