---
name: client-safety-check
description: Check browser-side code for the three known pitfalls (server imports in client files, unguarded localStorage, browser-dependent first render). Use after changing a client component or layout.
---

# Client safety check

## 1. Server code must not reach the browser
Client components must not import `lib/divinations.ts` or any database code (`lib/db.ts`, and anything that imports it). For kinds, labels, icons, and pages use `lib/divination-kinds.ts`. Data files used by client code must be pure (like `lib/sources.ts`, `lib/nav-groups.ts`-style files).

```bash
grep -lE '^"use client"|^.use client.' -r app components | xargs grep -nE 'from "(@/)?(lib/)?(\.\./)*(divinations|db|auth|session|oracle|patterns|days|predictions)"'
```
Also follow one level of imports for each client file. `npm run build` fails with a pg/net/fs error when this goes wrong; a build is the final proof.

## 2. localStorage and sessionStorage
Every read **and** write is in try/catch (it can throw in private windows or when blocked). The page must work with it empty.

```bash
grep -rnE 'localStorage|sessionStorage' app components lib
```
Open each hit and confirm the try/catch.

## 3. No browser-dependent first render
A client component must not draw anything on its first render that depends on `window`, `localStorage`, the time, the locale, or a colour read from the page. Draw it after an effect (see `ThemeLab`'s `ready` flag). A mismatch shows in the dev server output as "A tree hydrated but some attributes of the server rendered HTML didn't match" and names the element. Load a page with the dev server and read its terminal output (or `.next/dev/logs/next-development.log`) for that message.

## 4. Session-changing actions use a full load
Sign-in and sign-out use `window.location.assign(...)`, not `router.push`, because the layout is drawn on the server from the session. Any new action that changes the session or what the layout shows needs the same.

## 5. Next 16
Routing, `proxy.ts`, caching, and metadata differ from older Next. Use the `next16-docs` skill and read the guide in `node_modules/next/dist/docs/` before changing them.

## Report
List files checked, problems fixed, and the build/hydration result.
