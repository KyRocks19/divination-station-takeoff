// Runs once when the server starts, before it answers anything (Next.js 16 instrumentation).
// Next.js compiles this file for the Edge runtime as well as Node.js, so everything that needs Node.js is in instrumentation-node.ts,
// imported only inside the NEXT_RUNTIME === "nodejs" check (the pattern in the Next.js instrumentation guide). That keeps the Edge copy free of
// process.exit and the warning about it. The Edge runtime has nothing to set up.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerNode } = await import("./instrumentation-node");
    await registerNode();
  }
}
