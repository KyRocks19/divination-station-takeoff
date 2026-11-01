# App diagrams

Drawn on 2026-10-20 from the code at commit 6d5f0ce. Mermaid diagrams: GitHub and most editors draw them. `docs/app-map.md` is the written map; where this file and the code disagree, the code wins.

What was read: `lib/nav-groups.ts`, `lib/divination-kinds.ts`, `proxy.ts`, `app/layout.tsx`, `app/page.tsx`, `lib/db.ts`, `lib/edition.ts`, `components/tools/ReadingShell.tsx`, `app/api/dice/route.ts`, the `lib/companion-*` file names and imports, the folder listings of `app/` and `app/api/`, and the foreign keys in `migrations/`. What was not read line by line: most API routes, forum and circle internals, the picture worker script. Those parts are drawn from file names and imports.

## 1. How the pages connect

Every page sits behind the sign-in check in `proxy.ts`, except the public ones (`/login`, `/join`, `/recover`, `/setup`, `/privacy`). The side navigation and the home tiles are drawn from the same list (`NAV_GROUPS`).

```mermaid
flowchart TD
  subgraph PUBLIC["Public (no sign-in)"]
    login["/login"]
    join["/join (circle code)"]
    recover["/recover"]
    setup["/setup (local edition)"]
    privacy["/privacy"]
  end

  welcome["/welcome and /readings/first (first visit)"]
  home["/ Home: tool tiles, group tiles, tool summaries, today's sky"]

  login --> home
  join --> welcome --> home
  recover --> login
  setup --> home
  home -. "not signed in: redirect with ?from=" .-> login

  subgraph SHELL["Shell on every signed-in page (app/layout.tsx)"]
    header["AppHeader: search, + New reading, Settings, Log out"]
    side["SideNav / MobileNav"]
    feedbackwin["Feedback window"]
  end
  home --- SHELL

  subgraph TOOLS["Your tools (15 kinds, lib/divination-kinds.ts)"]
    direction TB
    tarot["/tarot"]
    oracle["/oracle"]
    scrying["/scrying"]
    pendulum["/pendulum"]
    runes["/runes"]
    ogham["/ogham"]
    dice["/dice"]
    iching["/iching"]
    geomancy["/geomancy"]
    biblio["/bibliomancy"]
    playing["/playingcards"]
    charms["/charms"]
    signs["/signs"]
    remote["/remoteview"]
    blots["/blots"]
  end

  subgraph WRITING["Your writings"]
    readings["/readings"]
    journals["/journals"]
    days["/days"]
    insights["/insights (Patterns)"]
    predictions["/predictions"]
    layouts["/layouts"]
  end

  subgraph LEARN["Learn"]
    library["/library"]
    archetypes["/archetypes"]
    sources["/sources"]
    forum["/forum (hosted only)"]
    circle["/circle (hosted only)"]
  end

  subgraph HELP["Help and about"]
    guide["/guide"]
    about["/about"]
    feedback["/feedback"]
  end

  subgraph ADMIN["Admin only"]
    users["/admin/users"]
    workers["/admin/workers"]
    adminlog["/admin/log"]
    reports["/forum/reports"]
  end

  settings["/settings (account, comfort, companion, export and import) and /design"]
  ask["/ask"]

  home --> TOOLS
  home --> WRITING
  home --> LEARN
  home --> HELP
  home --> ADMIN
  header --> settings
  header --> ask
  side --> TOOLS
  side --> WRITING
  side --> LEARN

  %% every tool follows the same page pattern
  subgraph PATTERN["Page pattern of each tool (dice shown)"]
    direction LR
    p_list["/dice  (history list)"] --> p_new["/dice/new  (make a reading)"]
    p_new --> p_one["/dice/[id]  (one reading)"]
    p_list --> p_one
    p_list --> p_set["/dice/set  (the pieces)"] --> p_piece["/dice/set/[object]/[face]  (one piece and my meaning)"]
  end
  dice -.-> p_list

  tarot --> readings
  tarot --> cards["/cards/[id]"]
  tarot --> encyclopedia["/encyclopedia, /encyclopedia/[concept]"]
  tarot --> spreads["/spreads"]
  readings --> readings_new["/readings/new"] --> readings_one["/readings/[id]"]
  oracle --> opulls["/oracle/pulls, /oracle/pulls/new, /oracle/pulls/[id]"]
  oracle --> ocards["/oracle/cards/[id]"]
  oracle --> ogallery["/oracle/gallery (pictures)"]
  layouts --> cloths["/layouts/cloths"]
  days --> dayone["/days/[date], /days/today"]
  library --> archetypes --> archone["/archetypes/[slug], /archetypes/review"]
  sources --> srctool["/sources/[tool]"]
  forum --> forumone["/forum/new, /forum/[id], /forum/[id]/edit"]
  about --> privacy

  %% what one reading page links onward to
  p_one --> J["Journal"]
  p_one --> PRED["Prediction"]
  p_one --> TAG["Tags"]
  p_one --> DAY["Add to a day"]
  p_one --> SHARE["Share as text or picture"]
  p_one --> AI["Companion, Interview, Guide (opt-in)"]
  J --> journals
  PRED --> predictions
  DAY --> days
  AI -. "feeds the person's own words" .-> insights
  p_piece --> archetypes
```

## 2. Data flow diagram

Level 1. Circles are processes, open boxes are data stores, rectangles are things outside the app. Nothing reaches the AI companion without the "Show what would be sent" step.

```mermaid
flowchart LR
  person["Person (browser or installed app)"]
  admin["Administrator"]
  worker["Picture and companion worker (a lender's computer, scripts/image-worker.ts)"]
  llm["Local model: KoboldCpp, COMPANION_URL"]
  imggen["Local image maker: IMAGE_GEN_URL"]
  claude["Claude API (user's own key, /api/claude/*)"]
  redis["Redis (write-limit counts)"]

  subgraph SERVER["Next.js 16 server"]
    P1(("P1 proxy.ts: host check, origin check, edition filter, body size, CSP nonce, session check, write limit"))
    P2(("P2 Pages: server components read the session, then query"))
    P3(("P3 API route handlers: own sign-in check, user_id scoping"))
    P4(("P4 lib/*: pure cores (-core, -shared, -data) and SQL files"))
    P5(("P5 Companion pipeline: context builder, code safety screen, risk check, questions"))
    P6(("P6 Picture queue: enqueue, claim, complete"))
    P7(("P7 Search, export, import, backup"))
  end

  subgraph STORES["Stores"]
    D1[("D1 Postgres: users, prefs, comfort")]
    D2[("D2 Readings: divinations + one table per tool")]
    D3[("D3 Own meanings, archetypes, concepts, links")]
    D4[("D4 Writing: journals, days, predictions, tags, layouts, cloths")]
    D5[("D5 Circles and forum")]
    D6[("D6 Queues: image_jobs, companion_jobs, worker_tokens, ai_usage")]
    D7[("D7 Shared encyclopedia: cards, runes, ogham data, sources")]
    D8[("D8 Local edition: PGlite folder and backups on the computer")]
  end

  person -->|"HTTP page requests, JSON writes"| P1
  admin --> P1
  P1 -->|"allowed requests"| P2
  P1 -->|"allowed requests"| P3
  P1 <-->|"count writes"| redis
  P2 --> P4
  P3 --> P4
  P4 <-->|"query, queryOne, withTransaction (lib/db.ts)"| D1
  P4 <--> D2
  P4 <--> D3
  P4 <--> D4
  P4 <--> D5
  P4 <--> D7
  P4 <-->|"edition = local"| D8

  P3 -->|"person's words + chosen readings"| P5
  P5 -->|"preview text first"| person
  P5 -->|"direct mode"| llm
  P5 -->|"queue mode: job row"| D6
  worker -->|"Bearer dsw_ token: claim, heartbeat"| D6
  worker -->|"asks the model on behalf of the job"| llm
  worker -->|"asks for pictures"| imggen
  worker -->|"results"| P6
  P3 --> P6
  P6 <--> D6
  P6 -->|"pictures saved"| D3
  P3 -->|"X-Claude-Key header"| claude
  P3 --> P7
  P7 <--> D1
  P7 <--> D2
  P7 <--> D3
  P7 <--> D4
  P7 -->|"zip, JSON"| person
```

## 3. One request, end to end: throwing dice

This is the pattern every tool follows (`app/api/dice/route.ts`).

```mermaid
sequenceDiagram
  actor Person
  participant Page as /dice/new (client component)
  participant Proxy as proxy.ts
  participant Route as POST /api/dice
  participant Lib as lib/dice, lib/divinations, lib/rng
  participant DB as Postgres

  Person->>Page: choose objects, optional layout, press Throw
  Page->>Proxy: POST /api/dice (Origin header)
  Proxy->>Proxy: host, origin, edition, size, session, write limit
  Proxy->>Route: pass with CSP nonce
  Route->>Route: getSession(), 401 if no userId
  Route->>Lib: cleanThrowItems, resolveLayout(userId)
  Route->>DB: read rng_method from users, then getPrefs
  Route->>Lib: createRng(method), pick faces, skyAt(now)
  Route->>DB: in one transaction, insertDivination (kind dice) and insert dice_throws
  Route-->>Page: { id }
  Page->>Person: router.push /dice/[id]
  Person->>Page: reading page (ReadingShell)
  Note over Page: journal, tags, predictions, add-to-day, share, and the opt-in companion panels all hang off divinations.id
```

## 4. The companion, from words to answer

```mermaid
sequenceDiagram
  actor Person
  participant UI as CompanionPanel
  participant Prev as GET /api/companion/preview
  participant Ask as POST /api/companion/ask
  participant Ctx as companion-subject and companion-context
  participant Run as companion-run (safety order)
  participant Q as companion_jobs
  participant W as Worker
  participant M as Local model

  Person->>UI: open panel
  UI->>Prev: what would be sent?
  Prev->>Ctx: build context from the person's own words only
  Prev-->>UI: exact text shown ("Show what would be sent")
  Person->>UI: confirm
  UI->>Ask: ask (mode, focus)
  Ask->>Ask: sign-in check, daily quota (ai-quota)
  alt direct mode
    Ask->>Run: runCompanion(context)
    Run->>Run: 1 code screen (crisis or check-in may answer alone)
    Run->>M: 2 risk check
    Run->>M: 3 questions
    Run-->>Ask: outcome
    Ask-->>UI: text
  else queue mode
    Ask->>Q: insert job
    W->>Q: claim (worker token)
    W->>Run: same three steps
    W->>M: model calls
    W->>Q: result
    UI->>Q: poll /api/companion/jobs/[id]
  end
  UI-->>Person: reply or saved note (companion_notes)
```

## 5. Class diagram (UML): the data model

Tables drawn as classes, foreign keys as associations. Each tool's own table links one to one to `divinations` (a shared header row with kind, title, question, summary, sky), which is why journals, tags, predictions and the companion work the same for every tool. Tarot is the older design: `readings` and `card_draws` came first, and since migration 023 each reading also has a `divinations` row (through `divinations.reading_id`) so it appears in the shared lists. A journal entry points at a tarot `reading_id` or at any `divination_id` (migration 022).

```mermaid
classDiagram
  direction LR

  class User {
    +id
    +username
    +is_admin
    +rng_method
    +comfort
    +tools : chosen DivinationKind[]
    +privacy_ack_version
  }

  class Divination {
    +id
    +kind : DivinationKind
    +title
    +question
    +summary
    +sky
    +layout_id
    +created_at
  }

  class ToolDetail {
    <<one table per tool>>
    +divination_id
    oracle_pulls
    rune_draws
    ogham_draws
    dice_throws
    iching_casts
    geomancy_charts
    bibliomancy_pulls
    scrying_sessions
    pendulum_answers
  }

  class Reading {
    <<tarot>>
    +id
    +spread_id
    +sky
  }
  class CardDraw {
    +card
    +position
    +reversed
  }
  class Journal {
    +reading_id : tarot, optional
    +divination_id : any tool, optional
    +text
  }
  class Tag
  class Prediction {
    +divination_id
    +check_ins
  }
  class DayEntry {
    +date
  }
  class DayItem {
    +kind
    +ref_id
  }
  class Layout
  class LayoutPosition
  class Cloth
  class ClothZone
  class ClothPlacement

  class OwnMeaning {
    <<card_customizations and per-tool meaning tables>>
    +piece_id
    +text
    +revisions
  }
  class OracleDeck
  class OracleCard
  class OracleCardArt
  class Archetype {
    <<shared, 84 root themes>>
    +slug
  }
  class UserArchetype
  class UserConcept
  class SymbolLink {
    <<user_symbol_links>>
  }

  class CompanionJob {
    +status
    +mode
    +worker_id
  }
  class CompanionNote
  class ImageJob {
    +status
    +worker_id
  }
  class WorkerToken
  class Circle
  class CircleMember
  class ForumPost
  class ForumComment
  class ForumReport

  User "1" --> "*" Divination : owns
  Divination "1" --> "0..1" ToolDetail : detail row
  Divination "*" --> "0..1" Layout : laid out by
  Divination "1" --> "*" Tag : divination_tags
  Divination "1" --> "*" Prediction
  Divination "1" --> "*" Journal
  Divination "0..1" --> "0..1" Reading : tarot only (reading_id)
  Divination "1" --> "*" CompanionJob
  Divination "1" --> "*" CompanionNote
  Divination "1" --> "0..*" ClothPlacement

  User "1" --> "*" Reading
  Reading "1" --> "*" CardDraw
  Reading "1" --> "*" Journal

  User "1" --> "*" Layout
  Layout "1" --> "*" LayoutPosition
  User "1" --> "*" Cloth
  Cloth "1" --> "*" ClothZone
  Cloth "1" --> "*" ClothPlacement

  User "1" --> "*" DayEntry
  DayEntry "1" --> "*" DayItem : points to readings, journals and more

  User "1" --> "*" OwnMeaning
  User "1" --> "*" OracleDeck
  OracleDeck "1" --> "*" OracleCard
  OracleCard "1" --> "0..1" OracleCardArt
  OracleCard "1" --> "*" ImageJob
  ImageJob "*" --> "0..1" WorkerToken
  CompanionJob "*" --> "0..1" WorkerToken

  User "1" --> "*" UserArchetype
  User "1" --> "*" UserConcept
  User "1" --> "*" SymbolLink
  SymbolLink "*" --> "0..1" Archetype
  SymbolLink "*" --> "0..1" UserArchetype
  SymbolLink "*" --> "0..1" UserConcept
  SymbolLink "*" --> "0..1" OracleCard

  Circle "1" --> "*" CircleMember
  User "1" --> "*" CircleMember
  User "1" --> "*" ForumPost
  ForumPost "1" --> "*" ForumComment
  ForumPost "1" --> "*" ForumReport
  ForumComment "1" --> "*" ForumReport
```

## 6. Class diagram (UML): the code layers

How a feature is split so that nothing server-only reaches the browser (`before-you-code`, section 4).

```mermaid
classDiagram
  direction TB
  class Page {
    <<app/**/page.tsx, server component>>
    reads getSession, getPrefs
    calls lib SQL files
  }
  class ClientComponent {
    <<"use client" in components/>>
    imports only pure files
    calls fetch /api/...
  }
  class RouteHandler {
    <<app/api/**/route.ts>>
    getSession check inside the handler
    scopes every query by userId
  }
  class PureCore {
    <<lib/x-core.ts, x-shared.ts, x-data.ts>>
    no database, no deck
    used by browser and tests
  }
  class SqlLib {
    <<lib/x.ts>>
    query, queryOne, withTransaction
  }
  class Db {
    <<lib/db.ts>>
    Neon pool with retries
    or PGlite when edition is local
  }
  class Proxy {
    <<proxy.ts>>
    host, origin, edition, size
    CSP nonce, session, write limit
  }
  class UiKit {
    <<components/ui and app/globals.css tokens>>
  }

  Proxy --> Page : lets through
  Proxy --> RouteHandler : lets through
  Page --> SqlLib
  Page --> ClientComponent : renders
  ClientComponent --> RouteHandler : fetch
  ClientComponent --> PureCore
  ClientComponent --> UiKit
  Page --> UiKit
  RouteHandler --> SqlLib
  RouteHandler --> PureCore
  SqlLib --> PureCore
  SqlLib --> Db
```

## Drift found while drawing (for `open-item-sync`)

- `docs/app-map.md` has no rows for charm casting, signs and dreams, playing cards, blind-target practice or tea leaves and ink, although `lib/divination-kinds.ts` lists them as tools and each has pages.
- Tarot is the one tool whose detail lives in older tables (`readings`, `card_draws`) joined to `divinations` by `reading_id`; every other tool has a detail table keyed by `divination_id`. Not a fault, but the one place where the pattern splits.
