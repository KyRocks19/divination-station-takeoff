import type { NextConfig } from "next";

// The Content-Security-Policy is not set here any more: it needs a fresh nonce for every request, so proxy.ts sets it (lib/csp.ts).

const nextConfig: NextConfig = {
  // The portable folder and the Docker image (scripts/build-local-package.ts, Dockerfile) run a self-contained server. Only they set this; the hosted build is unchanged.
  // The file tracer follows a read it cannot pin down into the project folder, and once one package is built that takes in dist, copying every earlier
  // package into the next one (scripts/build-local-package.ts refuses to finish then). The built packages stay out.
  ...(process.env.DS_STANDALONE === "1"
    ? { output: "standalone" as const, outputFileTracingExcludes: { "/**": ["./dist/divination-station*/**/*"] } }
    : {}),
  // pg, and PGlite (the full local edition's database, lib/local-db.ts: WebAssembly files that must be read from node_modules, not bundled).
  serverExternalPackages: ["pg", "@electric-sql/pglite"],
  // The Feathered edition (NEXT_PUBLIC_FEATHERED=1, docs/plan-feathered-edition.md) has no AI: the Anthropic package is swapped for a stand-in that
  // refuses, so its code is not in that build at all. Every other build is unchanged.
  ...(process.env.NEXT_PUBLIC_FEATHERED === "1"
    ? { turbopack: { resolveAlias: { "@anthropic-ai/sdk": "./lib/feathered-stubs/anthropic-sdk.ts" } } }
    : {}),
  // Do not announce the framework and version in every answer.
  poweredByHeader: false,
  // A picture is sent as base64 text, a third larger than the file. Pictures kept on disk may be up to 10 MB (lib/oracle-art.ts),
  // so requests must be allowed to carry about 14 MB; the default is 10 MB, and a longer body would be cut off and fail to read.
  experimental: { proxyClientMaxBodySize: "16mb" },
  // Dev only: let the dev server serve scripts/HMR to other hostnames, such as your Tailscale address (otherwise the page
  // never hydrates there). A comma-separated list in .env.development.local, for example
  // DEV_ALLOWED_ORIGINS=your-pc.your-tailnet.ts.net
  allowedDevOrigins: (process.env.DEV_ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  // The archetype pages were first called themes.
  async redirects() {
    return [
      { source: "/themes", destination: "/archetypes", permanent: false },
      { source: "/themes/:slug", destination: "/archetypes/:slug", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Browser features the app never uses stay switched off, even for a script that got in somehow. Clipboard writing
          // (copying a theme) and the folder picker (days) are not governed by this header. The accelerometer and gyroscope are
          // allowed for this site's own pages only, for the pendulum that a phone's movement can choose (components/pendulum/MotionAsk.tsx).
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), hid=(), accelerometer=(self), gyroscope=(self), magnetometer=(), browsing-topics=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
