---
name: next16-docs
description: Look up the bundled Next.js 16 docs before changing routing, proxy, caching, server/client components, metadata or config. Use when touching app/, proxy.ts or next.config.ts.
---

# Next.js 16: read the local docs first

This Next.js has breaking changes relative to older training data (AGENTS.md says so). Don't write from memory.

Docs are in `node_modules/next/dist/docs/` (App Router: `01-app/`; start at `index.md`):
- `01-app/01-getting-started/` covers structure, layouts, data fetching, caching, and **`16-proxy.md`**
- `01-app/02-guides/` covers authentication, backend-for-frontend, and more
- `01-app/03-api-reference/` covers file conventions, functions (`cookies`, `headers`), and config

## Procedure
1. Grep the docs for the API you're about to use.
2. Read the matching page fully; note deprecations.
3. Then write code, and mention the doc page you relied on.

## Known in this repo
- `proxy.ts` replaces `middleware.ts` (exports `proxy`, plus `config.matcher`).
- `cookies()` / `headers()` are async; `await` them (see `lib/session.ts`).
- Dynamic route `params` are Promises in route handlers and pages: `const { id } = await params`.
- PWA via `@ducanh2912/next-pwa`; check `next.config.ts` before changing build config.
