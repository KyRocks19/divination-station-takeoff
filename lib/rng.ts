import { webcrypto } from "node:crypto";
import { FEATHERED } from "./edition";

export type RngMethod = "math" | "crypto" | "random.org";

/**
 * Returns a Math.random()-style function (() => number in [0, 1)) backed by
 * the requested RNG method. For "random.org" a batch of 200 integers is
 * pre-fetched so that subsequent calls are synchronous; if the fetch fails it
 * falls back to "crypto" and logs a warning.
 */
export async function createRng(method: string, feathered = FEATHERED): Promise<() => number> {
  // The Feathered edition makes no outgoing connection (docs/plan-feathered-edition.md): random.org is answered by this computer instead.
  if (method === "crypto" || (feathered && method === "random.org")) {
    return () => {
      const arr = new Uint32Array(1);
      webcrypto.getRandomValues(arr);
      return arr[0] / 2 ** 32;
    };
  }

  // The Feathered build leaves this whole branch, and the address, out of its code. The value is written out, not FEATHERED, so it is fixed in
  // this very line when the app is built, which the bundler needs to drop the branch.
  if (method === "random.org" && process.env.NEXT_PUBLIC_FEATHERED !== "1" && !feathered) {
    try {
      const res = await fetch(
        "https://www.random.org/integers/?num=200&min=0&max=999999999&col=1&base=10&format=plain&rnd=new",
        { signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) throw new Error(`random.org returned ${res.status}`);
      const text = await res.text();
      const nums = text
        .trim()
        .split("\n")
        .map(Number)
        .filter((n) => !isNaN(n));
      if (nums.length === 0) throw new Error("random.org returned no numbers");
      let idx = 0;
      return () => {
        if (idx >= nums.length) {
          // Batch exhausted — fall back to crypto for remaining calls
          const arr = new Uint32Array(1);
          webcrypto.getRandomValues(arr);
          return arr[0] / 2 ** 32;
        }
        return nums[idx++] / 1_000_000_000;
      };
    } catch (err) {
      console.warn("[rng] random.org fetch failed, falling back to crypto:", err);
      return () => {
        const arr = new Uint32Array(1);
        webcrypto.getRandomValues(arr);
        return arr[0] / 2 ** 32;
      };
    }
  }

  // Default: "math"
  return () => Math.random();
}
