import { headers } from "next/headers";
import { snakePage } from "@/lib/snake-page";

// The quick exit's snake game (docs/plan-feathered-edition.md 4.5), answered as a whole document so nothing of the app is on it. proxy.ts sends every page
// here while this browser is locked by the quick exit. Open to anyone: it shows nothing of anyone's.
export async function GET() {
  const nonce = (await headers()).get("x-nonce") ?? "";
  return new Response(snakePage(nonce), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      // Never kept by the browser: the next look must ask the server, which decides whether this is still the game.
      "cache-control": "no-store",
    },
  });
}
