# Aula CRM

**Aula CRM** is a metadata-driven, multi-tenant Customer Relationship Management platform built on **Next.js 16** (App Router) and **React 19**. Almost every screen, API endpoint, validation rule, permission check, and lifecycle transition is derived from declarative **entity metadata** rather than hand-written per-screen code: declaring an entity (its fields, lifecycle, and nav group) automatically yields a list view, a detail drawer with inline edit, CRUD REST endpoints, optimistic-concurrency-safe writes, RBAC/ABAC enforcement, PII projection, search indexing, and audit trails. It ships with a complete CRM/Sales/Projects/Marketing/Support/People/Finance suite, a Dreams Technologies "CRMS" red design system (light + dark), webhooks, an in-app notification bell, a scheduler, and ~25 seeded demo entities across two tenants — all running **fully in-memory by default** (no database required) with clean swap points for PostgreSQL, Redis, and a real search engine.

The guiding principle behind the entire system is:

> **UI = f(metadata + state + permissions + data + locale + density + featureFlags + tenantContext)**

A screen is a pure function of the published metadata, the current request state, the caller's permissions, the underlying data, the active locale, the UI density, the resolved feature flags, and the tenant/org context. Change the metadata, and the UI, API, and enforcement all change together — there is one source of truth.

> **Backend wiring (production).** This app runs as a thin client of the
> standalone **Aula CRM backend** (`../Backend`, Express + MSSQL). The browser
> only talks to this app's own origin: every `/api/v1/*` request is proxied to
> the backend (`next.config.ts`), and server components fetch from it directly
> via `src/lib/http/server-api.ts` (`serverApi`), forwarding the caller's persona
> cookie / tenant / locale / bearer headers. Point at the backend with
> `BACKEND_API_URL` (default `http://localhost:4000`). To run the full stack
> locally with **no database**, start the backend with `AULA_PERSISTENCE=memory`
> (see `../Backend/README.md` §10). The embedded `src/lib` data layer remains the
> backend's source code (the backend is a faithful port of it) and powers the
> test suite, but the running app reads and writes through the backend service.

---

## Table of Contents

1. [Highlights / Feature Overview](#1-highlights--feature-overview)
2. [Tech Stack](#2-tech-stack)
3. [Architecture](#3-architecture)
4. [Project Structure](#4-project-structure)
5. [Getting Started](#5-getting-started)
6. [Available Scripts](#6-available-scripts)
7. [Metadata & Entity Model](#7-metadata--entity-model)
8. [Data Layer](#8-data-layer)
9. [Permissions, Roles & Multi-Tenancy](#9-permissions-roles--multi-tenancy)
10. [Domain & Lifecycle](#10-domain--lifecycle)
11. [Finance Module](#11-finance-module)
12. [Automation & Integrations](#12-automation--integrations)
13. [API Reference](#13-api-reference)
14. [Screens & Routes](#14-screens--routes)
15. [UI & Theming](#15-ui--theming)
16. [CRUD Operations](#16-crud-operations)
17. [Testing](#17-testing)
18. [Tooling Gotchas](#18-tooling-gotchas)
19. [Demo Data](#19-demo-data)
20. [Deployment / Production Notes](#20-deployment--production-notes)
21. [Project History / Changelog](#21-project-history--changelog)
22. [Acknowledgements & License](#22-acknowledgements--license)

---

## 1. Highlights / Feature Overview

Aula CRM covers a full CRM lifecycle across eight metadata groups and a set of cross-cutting platform capabilities. Every entity automatically gets a list screen, a record drawer (read/inline-edit/delete), search, audit, and CRUD endpoints.

| Module | Group(s) | What it provides |
|---|---|---|
| **CRM** | `crm` | Leads (with conversion), Accounts, Contacts, Tasks. Lead funnel `new → working → qualified/unqualified → converted`; lead conversion spawns Account + Contact + Deal. |
| **Sales** | `sales` | Deals (Kanban pipeline + lifecycle), Proposals, Estimations, Contracts, Sales Orders, Quotes & Invoices (finance docs). Deal stages drive a board view; winning a deal auto-creates an onboarding task. |
| **Projects** | `projects` | Projects, Milestones, Timesheets — budget, progress %, priority, billable hours. |
| **Marketing** | `marketing` | Campaigns (email/SMS/social/WhatsApp), board view by status, budget + sent counters. |
| **Support** | `support` | Tickets — priority (low→urgent), status board, account-linked. |
| **People** | `people` | Departments and Employees (with PII fields), headcount and org structure. |
| **Finance** | `finance` | Products & price book, Currencies, Tax Rates, Quotes/Invoices (master-detail line items, computed totals), Payments, Recurring Plans, quote→invoice conversion, billing runs, finance dashboard, number sequences, print/PDF. |
| **Communication** | (nav extras) | Email, Chat, Calls, File Manager, Social Feed, To-Do, Notes (presentation screens). |
| **Dashboards** | (nav extras) | Main dashboard plus 7 dedicated dashboards: Sales, Leads, Deals, Project, Executive, Revenue, Growth. KPI stats, pipeline bar chart, deals donut, recent activity. |
| **Admin** | `admin` | Settings hub (profile, security, notifications, appearance, roles matrix, users), metadata republish + release trail, reports hub. |
| **Automation** | (nav extras) | Webhooks (HMAC-signed, delivery log, test/ping, echo receiver), in-app notifications bell, scheduler jobs (billing-run, mark-overdue) with a cron tick endpoint. |

Cross-cutting platform features:

- **Metadata-driven everything** — entities/fields/lifecycles/layouts declared as data; UI, API, validation, and permissions all read from them.
- **Multi-tenancy** — strict tenant + org row-level isolation enforced centrally in the query engine.
- **RBAC + ABAC + PII projection** — role grants, record-ownership checks for mutations, and field-level PII redaction for callers lacking `pii:read`.
- **Optimistic concurrency** — every record carries a `version`; writes use `If-Match`.
- **Lifecycle state machines** — metadata-declared transitions with permission `requires` and invariant `guards`.
- **Event-driven workflows** — transactional outbox, idempotency, retry, and an in-memory event bus.
- **Full-text-ish search** — `Cmd/Ctrl+K` command palette searches records (permission-filtered).
- **CRMS red theme** — light + dark via class-based dark mode and Tailwind v4 tokens.
- **Runs with zero infrastructure** — in-memory repository, cache, event bus, and search by default.

---

## 2. Tech Stack

Exact versions from `package.json`:

### Runtime dependencies

| Package | Version | Role |
|---|---|---|
| `next` | `16.2.7` | App Router framework (server components, REST route handlers, Turbopack) |
| `react` | `19.2.4` | UI library |
| `react-dom` | `19.2.4` | React DOM renderer |
| `zod` | `^4.4.3` | Metadata definition + record validation schemas |
| `lucide-react` | `^1.17.0` | Icon set |
| `recharts` | `^3.8.1` | Dashboard charts (bar/donut) |
| `sonner` | `^2.0.7` | Toast notifications |

### Dev dependencies

| Package | Version | Role |
|---|---|---|
| `typescript` | `^5` | Type system |
| `eslint` | `^9` | Linting (flat config) |
| `eslint-config-next` | `16.2.7` | Next.js lint rules |
| `tailwindcss` | `^4` | Styling (no config file; PostCSS plugin) |
| `@tailwindcss/postcss` | `^4` | Tailwind v4 PostCSS integration |
| `@types/node` | `^20` | Node types |
| `@types/react` | `^19` | React types |
| `@types/react-dom` | `^19` | React DOM types |

**Other facts:** package `name` is `aula-crm`, `version` `0.1.0`, `private: true`. There is **no `engines` field**; Node 20 is pinned only in CI, and local development has been run on Node v22.19.0. Tests use the native `node:test` runner (no Jest/Vitest). Fonts are Geist Sans / Geist Mono. `@playwright/test` is referenced by the (excluded) e2e suite but is **not** declared as a dependency.

---

## 3. Architecture

### 3.1 The layered model

Aula CRM is organized into strictly layered modules under `src/lib/**`, each of which opens with a `Phase N —` header comment naming its layer. **Dependencies point downward only.**

```
┌──────────────────────────────────────────────────────────────────────┐
│  UI            src/app/** (pages + API routes) · src/components/**     │  Phase 10 / 9
│                server components call domain services;                 │
│                client components call the REST API                     │
├──────────────────────────────────────────────────────────────────────┤
│  API plumbing  src/lib/http/** (runApi wrapper, server-context)        │  Phase 9
├──────────────────────────────────────────────────────────────────────┤
│  Domain        src/lib/domain/** (orchestration: lifecycle,            │  Phase 7
│                invariants, audit, events)                              │
│    ├─ Workflow src/lib/workflow/** (event-bus, outbox, idempotency)    │  Phase 8
│    ├─ Finance  src/lib/finance/** (money, totals, sequences, service)  │  Phase F
│    └─ Integr.  src/lib/integrations/** (webhooks, notifications, I/O)  │
├──────────────────────────────────────────────────────────────────────┤
│  Data gateway  src/lib/data/** (QueryEngine + Repository)              │  Phase 5
│                THE single gateway through which all data flows         │
├──────────────────────────────────────────────────────────────────────┤
│  Permissions   src/lib/permissions/** (RBAC + ABAC + PII projection)   │  Phase 6
├──────────────────────────────────────────────────────────────────────┤
│  Metadata      src/lib/metadata/** (entity/field/lifecycle defs)       │  Phase 2
│                the source of truth                                     │
├──────────────────────────────────────────────────────────────────────┤
│  Context       src/lib/context/** (RequestContext: tenant/org/roles)   │  Phase 4
├──────────────────────────────────────────────────────────────────────┤
│  Cross-cutting security / search / cache / config / observability      │  13/12/14/11
├──────────────────────────────────────────────────────────────────────┤
│  Core          src/lib/core/** (clock, ids, Result)                    │  Phase 1
│                lowest layer — no upward dependencies                   │
└──────────────────────────────────────────────────────────────────────┘
```

The central invariant (from `src/lib/data/query-engine.ts`) is that the **QueryEngine is the single gateway through which all data flows** — higher layers (domain services, API) never touch the repository directly. Every QueryEngine operation is tenant-scoped (`scopeOf(ctx)`), permission-gated (`permissions.evaluate`), metadata-validated, unique-constraint-checked, optimistic-concurrency-protected, and field-projected.

### 3.2 The dependency rule (ESLint boundaries)

Two `no-restricted-imports` rules in `eslint.config.mjs` (both `"error"`) enforce the boundaries that matter most:

**1. Core is the floor — it cannot import any higher layer:**

```js
files: ["src/lib/core/**/*.ts"]
"no-restricted-imports": ["error", { patterns: [{
  group: ["@/lib/*/*", "@/app/*", "@/components/*"],
  message: "core is the lowest layer and cannot import higher layers."
}]}]
```

**2. UI cannot reach data/workflow internals — it must go through a domain service or the REST API:**

```js
files: ["src/components/**/*.{ts,tsx}", "src/app/**/page.tsx", "src/app/**/layout.tsx"]
"no-restricted-imports": ["error", { patterns: [{
  group: ["@/lib/data/memory-repository", "@/lib/data/store", "@/lib/workflow/*"],
  message: "UI cannot import data/workflow internals directly — use a domain service or the API."
}]}]
```

Note the precise scope of the second rule: its `files` glob targets only `src/components/**/*.{ts,tsx}`, `src/app/**/page.tsx`, and `src/app/**/layout.tsx`. **API route handlers (`src/app/api/**/route.ts`) are intentionally *not* covered** — they sit on the API plumbing tier, not the UI tier, and are therefore allowed to reach data/domain internals directly. This is why a `route.ts` can call the store/query engine; in practice it does so through `getDomainService()` / `getQueryEngine()` rather than importing `memory-repository`/`store` itself.

The flat config (`defineConfig`) spreads `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript`, and globally ignores `.next/**`, `out/**`, `build/**`, `next-env.d.ts`, and `coverage/**`. The downward-only rule for `domain`/`metadata`/`data` is otherwise a convention reinforced by the phase-header comments and the runtime gateway, not an additional lint rule.

### 3.3 How metadata drives the UI / API / permissions

- **UI:** `src/app/[entity]/page.tsx` resolves *any* registered entity from the metadata resolver and renders a list + detail screen with no per-entity code. The sidebar nav is built from `metadata.listEntities()` (minus `system` entities).
- **API:** the generic `/api/v1/entities/[entity]` routes serve CRUD for any entity; `parseListQuery` honors only metadata-declared `filterable`/`sortable`/`searchable` fields.
- **Validation:** Zod create/update schemas are derived per entity by `buildCreateSchema` / `buildUpdateSchema`, automatically skipping `readOnly`/`computed` fields.
- **Permissions:** RBAC actions are `<entity>:<verb>`; PII redaction reads `field.pii`; ABAC ownership uses the entity's `ownable` flag.
- **Lifecycle:** state machines, transition actions, guards, and required permissions are all declared in each entity's `lifecycle` block.

### 3.4 Core result type

`src/lib/core/result.ts` (Phase 1, the bottom layer) provides a tiny explicit-failure type used across enforcement surfaces so callers can branch on failures instead of relying solely on thrown exceptions:

```ts
export type Ok<T>  = { ok: true;  value: T };
export type Err<E> = { ok: false; error: E };
export type Result<T, E = Error> = Ok<T> | Err<E>;
```

Helpers: `ok(value)`, `err(error)`, `isOk(r)` / `isErr(r)` (type guards), and `unwrap(r)` (returns the value or throws the error, coercing non-`Error` errors via `new Error(String(error))`).

### 3.5 Observability (Phase 11)

`src/lib/observability/` is a small, OpenTelemetry-shaped instrumentation layer (barrel `index.ts`) that the API plumbing and tracing helper use, and that the health endpoint surfaces. It is designed to be swapped for a real OTel meter/tracer/exporter without touching call sites.

- **`logger.ts`** — a structured JSON logger (`logger = new Logger({ service: "aula-crm" })`) emitting one JSON line per event with levels `debug|info|warn|error`. It **redacts sensitive keys** (`password`, `token`, `secret`, `authorization`, `apikey`/`apiKey`, `email`, `phone`, `ssn`) recursively so secrets/PII never reach logs, and supports `child(fields)` loggers that carry base fields such as `correlationId`. Used by `runApi` to log 500s (`logger.error("api error", { correlationId, ... })`) and by `withSpan`.
- **`metrics.ts`** — minimal in-process counters + histograms (`metrics = new Metrics()`): `increment(name, by?)`, `observe(name, value)` (tracks count/sum/min/max), and `snapshot()` (returns `{ counters, histograms }` with computed `avg`). `runApi` increments `api.requests` on every call and `api.errors` on failures; `GET /api/v1/health` returns `metrics.snapshot()`.
- **`tracing.ts`** — `withSpan(name, fn, attrs?)` times an async operation, recording `span.<name>.count`, `span.<name>.ms` (and `span.<name>.error` on failure) into `metrics`, and emitting a correlation-id-tagged debug/warn span log. The shape mirrors OpenTelemetry so it can be replaced by a real tracer/exporter without changing call sites.

---

## 4. Project Structure

Annotated tree of `src/` (exact paths under `aula-crm/src/`):

```
src/
├─ proxy.ts                              # Next 16 middleware (renamed) — security headers + CSRF cookie
├─ app/                                  # Next.js App Router — UI + REST API (top layer)
│  ├─ layout.tsx, page.tsx, globals.css  # root layout, main dashboard, theme tokens
│  ├─ error.tsx, not-found.tsx, loading.tsx, favicon.ico
│  ├─ [entity]/page.tsx                  # GENERIC metadata-driven list/detail screen
│  ├─ api/v1/                            # Versioned REST API (Phase 9); all wrapped by runApi
│  │  ├─ entities/[entity]/[id]/{audit,transitions}/   # generic CRUD + lifecycle + audit
│  │  ├─ meta/[entity]/                  # metadata for a screen
│  │  ├─ leads/[id]/convert/             # lead → account + contact + deal
│  │  ├─ quotes/[id]/convert/            # quote → invoice
│  │  ├─ invoices/[id]/payments/         # apply payment (recomputes balance/status)
│  │  ├─ recurring/run/                  # billing run
│  │  ├─ cron/tick/                      # scheduler tick (billing-run, mark-overdue)
│  │  ├─ webhooks/[id]/test, webhooks/echo/   # outbound webhooks + test receiver
│  │  ├─ admin/metadata/republish, admin/releases/   # governance + release trail
│  │  ├─ import/[entity], export/[entity]/    # CSV import/export
│  │  └─ aggregate, stats, search, activity, notifications, health/
│  ├─ login, register, forgot-password, reset-password, lock-screen,
│  │  two-step-verification, email-verification/      # auth pages (chrome-free)
│  ├─ {sales,deals,leads,project,revenue,growth,executive}-dashboard/   # 7 dashboards
│  ├─ pipeline/                          # deal Kanban board
│  ├─ calendar/, activity/, finance/     # cross-entity screens
│  ├─ quote/[id]/{print}, invoice/[id]/{print}/   # dedicated finance docs (override [entity])
│  ├─ reports/{deals,leads,projects,revenue,sales}/   # reports hub
│  ├─ settings/{appearance,notifications,profile,roles,security,users}/   # admin hub
│  ├─ automation/                        # webhooks + notifications + scheduler admin
│  ├─ email, chat, calls, file-manager, social-feed, todo, notes/   # comms screens
│  └─ coming-soon, under-maintenance, error-500/     # utility pages
│
├─ components/                           # UI components (cannot import data/workflow internals)
│  ├─ crm/                               # app-specific: app-shell, shell-client, sidebar, mobile-nav,
│  │                                     #   data-table, record-drawer, create-drawer, kanban-board,
│  │                                     #   calendar-view, command-palette, dashboard-charts,
│  │                                     #   document-editor/print, line-items-editor, payments-panel,
│  │                                     #   notifications-bell, settings-admin, automation-admin,
│  │                                     #   actor-switcher, field-input/format, value-cell, breadcrumbs
│  └─ ui/                                # primitives: button, card, table, tabs, drawer, badge,
│                                        #   input, dropdown-menu, theme-provider, theme-toggle,
│                      
                  #   icon, skeleton, spinner, empty-state
│
└─ lib/                                  # Layered backend (dependencies point downward)
   ├─ core/            clock.ts, ids.ts, result.ts            # Phase 1 — bottom layer
   ├─ metadata/        types, registry, resolver, schema, validation, index   # Phase 2 — source of truth
   │  └─ entities/     ~25 EntityDefs + shared.ts             # all entity definitions
   ├─ enforcement/     errors.ts, guards.ts                   # Phase 3 — error/guard primitives
   ├─ context/         types, resolver, isolation, dev, config   # Phase 4 — RequestContext / tenancy
   ├─ permissions/     engine, policies, cache, types          # Phase 6 — RBAC + ABAC + PII
   ├─ data/            query-engine, repository, memory-repository, store, seed, query   # Phase 5 — gateway
   ├─ domain/          service, state-machine, invariants, audit, index   # Phase 7 — orchestration
   ├─ workflow/        event-bus, outbox, idempotency, retry, workflows, engine   # Phase 8
   ├─ finance/         service, money, totals, number-sequence   # Phase F — billing/AR
   ├─ integrations/    webhooks, notifications, import-export, adapters
   ├─ jobs/            scheduler.ts                            # billing-run + mark-overdue
   ├─ http/            handler.ts (runApi), server-context.ts  # Phase 9 — API plumbing
   ├─ search/          engine, indexer, service                # Phase 12
   ├─ cache/           cache, invalidation                     # Phase 12
   ├─ security/        auth, crypto, csrf, rate-limit, xss      # Phase 13 (auth swap point)
   ├─ config/          feature-flags, governance, migrations, release, env   # Phase 14
   ├─ observability/   logger, metrics, tracing                # Phase 11
   ├─ utils/           cn.ts
   ├─ bootstrap.ts     # ensurePlatform() — wires all event subscribers once
   └─ api-client.ts    # client-side apiFetch (ApiRequestError, custom headers, If-Match)
```

**Each `src/lib/<layer>/` folder exposes a barrel `index.ts` as its public API** — consumers import from the folder (e.g. `@/lib/config`, `@/lib/domain`, `@/lib/data`), not from individual files. Barrels exist for `cache`, `config`, `context`, `data`, `domain`, `enforcement`, `finance`, `integrations`, `metadata`, `observability`, `permissions`, `search`, `security`, and `workflow`.

**Outside `src/`:**

- **`public/`** holds only the default Next.js starter SVGs (`file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`) — none are referenced by the app and they are otherwise unused leftovers. The app's favicon lives under `src/app/favicon.ico`, not here.
- **Generated / gitignored root artifacts:** `next-env.d.ts` (Next.js type shim) and `tsconfig.tsbuildinfo` (incremental TS build cache) are generated on disk and ignored. `.gitignore` ignores `node_modules`, `.next/`, `out/`, `build`, `coverage`, `.env*`, `*.pem`, `.vercel`, `*.tsbuildinfo`, and `next-env.d.ts`.

---

## 5. Getting Started

### 5.1 Prerequisites

- **Node.js** — there is no `engines` field; CI uses **Node 20**, and the project has been run locally on **Node 22.19.0**. Use Node 20+.
- **npm** — a lockfile is present, so `npm ci` is recommended.
- **No database, Redis, or search server required** — the app runs entirely in-memory by default.

### 5.2 Install

```bash
# from the aula-crm directory
npm ci          # preferred (uses the lockfile)
# or
npm install
```

> All commands below are run from the `aula-crm/` directory.

### 5.3 Environment variables / secrets

Environment is validated and typed in `src/lib/config/env.ts` via a Zod schema parsing `process.env`. Invalid values throw `Invalid environment: ...`.

| Variable | Type | Default | Purpose |
|---|---|---|---|
| `NODE_ENV` | enum `development \| production \| test` | `development` | Runtime mode |
| `AULA_JWT_SECRET` | optional string | — | HS256 JWT signing/verification secret (production auth) |
| `AULA_ENCRYPTION_KEY` | optional string | — | AES-256-GCM key (falls back to `dev-insecure-key-change-me`) |
| `AULA_DATABASE_URL` | optional string | — | PostgreSQL URL; when **set**, the app expects external backends |
| `AULA_REDIS_URL` | optional string | — | Redis URL for cache/event bus |

**In-memory default behavior:** when `AULA_DATABASE_URL` and `AULA_REDIS_URL` are absent (the default for tests and the demo), the app uses in-memory backends — `usingInMemoryBackends = !env.AULA_DATABASE_URL`. The `/api/v1/health` endpoint reports `backends: "in-memory"` or `"external"` accordingly.

**Production secret behavior** (when `NODE_ENV=production` and *not* during `next build`, detected via `NEXT_PHASE === "phase-production-build"`):
- If `AULA_DATABASE_URL` is set but `AULA_JWT_SECRET` / `AULA_ENCRYPTION_KEY` are missing → **throws** `Missing production secrets: ...`.
- If `AULA_DATABASE_URL` is *not* set → only `console.warn`s and uses insecure dev defaults (in-memory mode).

Copy `.env.example` to `.env.local` to configure. `.gitignore` ignores `.env*`. Exports from `env.ts`: `env`, `isProduction`, `usingInMemoryBackends`.

### 5.4 Run, build, start

```bash
npm run dev      # start the dev server (http://localhost:3000)
npm run build    # production build
npm run start    # serve the production build
```

When you open the app, you are signed in as **Avery Admin** by default. Use the persona switcher in the header (or the `/login` page) to change roles.

---

## 6. Available Scripts

Verbatim from `package.json`:

| Script | Command | Description |
|---|---|---|
| `dev` | `next dev` | Start the Next.js dev server. |
| `build` | `next build` | Produce a production build. |
| `start` | `next start` | Serve the production build (run after `build`). |
| `lint` | `eslint` | Run ESLint (flat config + architecture boundary rules). |
| `typecheck` | `tsc --noEmit` | Type-check without emitting. |
| `test` | `node --experimental-transform-types --import ./tests/register.mjs --test "tests/**/*.test.ts"` | Run the `node:test` suite with TS type-stripping. |
| `seed` | `node --experimental-transform-types --import ./tests/register.mjs scripts/seed.ts` | **Currently broken** — see note below. |

> ⚠️ **The `seed` script does not work as written.** Neither `scripts/seed.ts` nor the entire `scripts/` directory exists in the repo, so `npm run seed` fails with a module-not-found error. **Seeding does not require a CLI script:** it happens automatically at runtime. `getQueryEngine()` (`src/lib/data/store.ts`) lazily calls `seedInto(repo)` exactly once on first access (`singletons.seedPromise ??= seedInto(singletons.repo)`), and `ensurePlatform()` runs `reindexAll()` afterward. The canonical seed entry point is therefore **`seedInto(repo)` in `src/lib/data/seed.ts`** (see §19), not a standalone script. To make `npm run seed` usable, add a `scripts/seed.ts` that imports and invokes `seedInto` against a repository.

**CI** (`.github/workflows/ci.yml`): on push to `main` + PRs, Node 20, `working-directory: aula-crm` → `npm ci` → `npm run lint` → `npm run typecheck` → `npm test` → `npm run build`. CI does **not** invoke `npm run seed`.

---

## 7. Metadata & Entity Model

### 7.1 The system

The metadata layer (`src/lib/metadata/`) is the source of truth. Entities, fields, layouts, and lifecycles are declared as data; the data layer, permission engine, API, and UI all read from these rather than hard-coding behavior.

- **`types.ts`** — the core contracts: `FieldType` (13 types: `string`, `text`, `number`, `currency`, `percent`, `boolean`, `date`, `datetime`, `email`, `phone`, `url`, `enum`, `reference`), `FieldDef`, `EnumOption` (with semantic `tone`), `LifecycleDef`/`LifecycleTransition`, `ListColumn`, `EntityGroup` (8 groups), `ViewType` (`table`/`board`/`calendar`), `ParentRef` (master-detail), and `EntityDef`. Also `SystemFields` (`id`, `tenantId`, `orgId`, `ownerId`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy`, `version`), `EntityRecord`, and `MetadataStatus` (`draft`/`published`/`archived`).
- **`schema.ts`** — Zod validation of entity *definitions* so a malformed entity can never publish. Field `name`s must be camelCase (`/^[a-z][a-zA-Z0-9]*$/`); enum fields need ≥1 option; reference fields need a `referenceEntity`; the `group` enum is exactly `["crm","sales","projects","marketing","support","people","finance","admin"]`. A `superRefine` enforces that `titleField` and `lifecycle.field` are defined fields and that every transition `from`/`to` is a known state.
- **`registry.ts`** — `MetadataRegistry`: versioned `createDraft` → `publish` pipeline (metadata is immutable once published; archived versions can be re-published for rollback). `validateEntities` additionally performs a cross-entity check that every `reference` field points at a known entity, throwing `MetadataValidationError` (with `issues[]`) otherwise.
- **`resolver.ts`** — `MetadataResolver`: thin read API over the active published version (`listEntities`, `findEntity`, `getEntity`, `getField`, `getLifecycle`, `piiFields`).
- **`validation.ts`** — runtime record validators derived from metadata: `buildCreateSchema` (skips `readOnly`/`computed`; a field is required only if `required && defaultValue === undefined`), `buildUpdateSchema` (all fields optional), and `validateRecord` (returns `{ success, data }` or `{ success, issues }`).
- **`index.ts`** — bootstrap: imports all entity defs into `crmEntities`, then `createDraft` + `publish(..., "system", ...)` at import time so the resolver always has an active version. Exports `metadataRegistry`, `metadata`, validation helpers, and types.

### 7.2 All entities

~25 registered entities. Default `viewType` is `table` and default `group` is `crm` unless noted. Only `deal`, `campaign`, and `ticket` set a `board`; no entity sets `calendar` or an explicit `viewType`.

| Entity | Label / Plural | Group | View | Key fields (title in **bold**) | Lifecycle | Board | Parent | Ownable | System |
|---|---|---|---|---|---|---|---|---|---|
| `lead` | Lead / Leads | crm | table | **name**, company, email, phone, source, estimatedValue, status | `status` | — | — | ✅ | — |
| `account` | Account / Accounts | crm | table | **name**, industry, website, phone, annualRevenue, employees | — | — | — | ✅ | — |
| `contact` | Contact / Contacts | crm | table | firstName, **lastName**, email, phone, title, accountId→account | — | — | — | ✅ | — |
| `deal` | Deal / Deals | **sales** | table | **name**, stage, amount, probability, closeDate, accountId→account | `stage` | `stage` | — | ✅ | — |
| `task` | Task / Tasks | crm | table | **subject**, status, dueDate, notes, dealId→deal | — | — | — | ✅ | — |
| `proposal` | Proposal / Proposals | sales | table | **title**, accountId→account, status, amount, validUntil | — | — | — | ✅ | — |
| `estimation` | Estimation / Estimations | sales | table | **number**, accountId→account, status, amount, expiryDate | — | — | — | ✅ | — |
| `contract` | Contract / Contracts | sales | table | **title**, accountId→account, status, value, startDate, endDate | — | — | — | ✅ | — |
| `salesOrder` | Sales Order / Sales Orders | sales | table | **number**, accountId→account, status, amount, orderDate | — | — | — | ✅ | — |
| `quote` | Quote / Quotes | sales | table | **number** (RO), accountId→account, status, currencyCode, validUntil, subtotal/taxTotal/total (computed), notes | `status` | — | — | ✅ | — |
| `quoteLine` | Quote Line / Quote Lines | **finance** | table | **description**, quoteId→quote, productId→product, qty, unitPrice, taxRate, lineTotal (computed) | — | — | quote/quoteId | — | ✅ |
| `invoice` | Invoice / Invoices | sales | table | **number** (RO), accountId→account, quoteId→quote, status, currencyCode, issueDate, dueDate, subtotal/taxTotal/total/amountPaid/balance (computed), notes | `status` | — | — | ✅ | — |
| `invoiceLine` | Invoice Line / Invoice Lines | finance | table | **description**, invoiceId→invoice, productId→product, qty, unitPrice, taxRate, lineTotal (computed) | — | — | invoice/invoiceId | — | ✅ |
| `project` | Project / Projects | projects | table | **name**, accountId→account (Client), status, priority, budget, progress, startDate, dueDate | — | — | — | ✅ | — |
| `milestone` | Milestone / Milestones | projects | table | **name**, projectId→project, status, amount, dueDate | — | — | — | ✅ | — |
| `timesheet` | Timesheet / Timesheets | projects | table | **title** (Description), projectId→project, hours, date, billable, status | — | — | — | ✅ | — |
| `campaign` | Campaign / Campaigns | marketing | table | **name**, channel, status, budget, sent, startDate, endDate | — | `status` | — | ✅ | — |
| `ticket` | Ticket / Tickets | support | table | **subject**, accountId→account, priority, status, assignee | — | `status` | — | ✅ | — |
| `department` | Department / Departments | people | table | **name**, head, headcount | — | — | — | — | — |
| `employee` | Employee / Staff | people | table | **firstName**, lastName, email, phone, title, departmentId→department, status | — | — | — | — | — |
| `product` | Product / Products | finance | table | **name**, sku, unitPrice, currencyCode, taxRate, active | — | — | — | — | — |
| `currency` | Currency / Currencies | finance | table | **code**, symbol, rate | — | — | — | — | — |
| `taxRate` | Tax Rate / Tax Rates | finance | table | **name**, rate, region | — | — | — | — | — |
| `payment` | Payment / Payments | finance | table | **number** (RO), invoiceId→invoice, accountId→account, amount, method, paidAt, notes | — | — | — | ✅ | — |
| `recurringPlan` | Recurring Plan / Recurring | finance | table | **name**, accountId→account, description, amount, taxRate, currencyCode, frequency, nextRun, active | — | — | — | ✅ | — |

Registration order in `crmEntities`: lead, account, contact, deal, task · *(sales)* proposal, estimation, contract, salesOrder, quote, quoteLine, invoice, invoiceLine · *(projects)* project, milestone, timesheet · *(marketing)* campaign · *(support)* ticket · *(people)* department, employee · *(finance/catalog)* product, currency, taxRate, payment, recurringPlan.

<details>
<summary><strong>Complete field catalog (every entity, every field)</strong></summary>

Notation: `name:type` then flags — `req`=required, `uniq`=unique, `pii`, `RO`=readOnly, `computed`, `min/max`, `def=`default, `→entity`=reference target. Enum fields list `value(tone)`.

#### CRM group

**lead** — icon `lead`, titleField `name`, ownable. Lifecycle on `status`.
- `name`:string req, search, sort, min1 max120
- `company`:string search/sort/filter
- `email`:email search, pii
- `phone`:phone pii
- `source`:enum filter — web(info), referral(success), event(warning), coldcall(neutral), other(neutral)
- `estimatedValue`:currency sort min0
- `status`:enum req filter/sort def=`new` — new(neutral), working(info), qualified(success), unqualified(danger), converted(success)
- Lifecycle: field `status`, initial `new`, states [new, working, qualified, unqualified, converted], final [unqualified, converted]. Transitions: new→working `start` (lead:update); working→qualified `qualify` (lead:update); new→unqualified `disqualify` (lead:update); working→unqualified `disqualify` (lead:update).

**account** — icon `building`, titleField `name`, ownable.
- `name`:string req, uniq, search/sort/filter, min1 max120
- `industry`:enum filter — technology(info), finance(success), healthcare(warning), retail(neutral), manufacturing(neutral)
- `website`:url search
- `phone`:phone
- `annualRevenue`:currency sort/filter min0
- `employees`:number sort min0

**contact** — icon `user`, titleField `lastName`, ownable.
- `firstName`:string req search/sort min1 max60
- `lastName`:string req search/sort/filter min1 max60
- `email`:email req uniq search pii
- `phone`:phone pii
- `title`:string search
- `accountId`:reference →account filter

**deal** — icon `target`, group `sales`, titleField `name`, ownable, board `stage`. Lifecycle on `stage`.
- `name`:string req search/sort min1 max120
- `stage`:enum req filter/sort def=`lead` — lead(neutral), qualified(info), proposal(info), negotiation(warning), won(success), lost(danger)
- `amount`:currency sort/filter min0
- `probability`:number min0 max100
- `closeDate`:date sort
- `accountId`:reference →account filter
- Lifecycle: field `stage`, initial `lead`, states [lead, qualified, proposal, negotiation, won, lost], final [won, lost]. Transitions: lead→qualified `qualify` (deal:update); qualified→proposal `propose` (deal:update); proposal→negotiation `negotiate` (deal:update); negotiation→won `win` (**deal:win**, guards [`amountPositive`]); lead/qualified/proposal/negotiation→lost `lose` (deal:update, four transitions).

**task** — icon `check`, titleField `subject`, ownable.
- `subject`:string req search/sort min1 max160
- `status`:enum req filter def=`open` — open(info), done(success)
- `dueDate`:date sort
- `notes`:text
- `dealId`:reference →deal filter

#### Sales group

**proposal** — icon `proposal`, group `sales`, titleField `title`, ownable.
- `title`:string req search/sort min1 max160
- `accountId`:reference →account filter
- `status`:enum req filter/sort def=`draft` — draft(neutral), sent(info), accepted(success), declined(danger)
- `amount`:currency sort/filter min0
- `validUntil`:date sort

**estimation** — icon `estimation`, group `sales`, titleField `number`, ownable.
- `number`:string req uniq search/sort
- `accountId`:reference →account filter
- `status`:enum req filter/sort def=`draft` — draft(neutral), sent(info), approved(success), rejected(danger)
- `amount`:currency sort/filter min0
- `expiryDate`:date sort

**contract** — icon `contract`, group `sales`, titleField `title`, ownable.
- `title`:string req search/sort min1 max160
- `accountId`:reference →account filter
- `status`:enum req filter/sort def=`draft` — draft(neutral), active(success), expired(warning), terminated(danger)
- `value`:currency sort/filter min0
- `startDate`:date sort
- `endDate`:date sort

**salesOrder** — icon `order`, group `sales`, titleField `number`, ownable.
- `number`:string req uniq search/sort
- `accountId`:reference →account filter
- `status`:enum req filter/sort def=`pending` — pending(neutral), confirmed(info), shipped(warning), completed(success), cancelled(danger)
- `amount`:currency sort/filter min0
- `orderDate`:date sort

**quote** — icon `quote`, group `sales`, titleField `number`, ownable. Lifecycle on `status`.
- `number`:string **RO** search/sort (assigned by finance service)
- `accountId`:reference →account req filter
- `status`:enum req filter/sort def=`draft` — draft(neutral), sent(info), accepted(success), declined(danger), expired(warning)
- `currencyCode`:enum def=`USD` (CURRENCY_OPTIONS)
- `validUntil`:date sort
- `subtotal`:currency **computed**
- `taxTotal`:currency **computed**
- `total`:currency **computed** sort
- `notes`:text
- Lifecycle: field `status`, initial `draft`, states [draft, sent, accepted, declined, expired], final [accepted, declined, expired]. Transitions: draft→sent `send`; sent→accepted `accept`; sent→declined `decline`; sent→expired `expire` (all quote:update).

**quoteLine** — no icon, group `finance`, `system: true`, titleField `description`, parent { quote, quoteId }. Not ownable.
- `quoteId`:reference →quote req filter
- `productId`:reference →product
- `description`:string req
- `qty`:number req min0 def=1
- `unitPrice`:currency req min0
- `taxRate`:percent def=0 min0 max100
- `lineTotal`:currency **computed**

**invoice** — icon `invoice`, group `sales`, titleField `number`, ownable. Lifecycle on `status`.
- `number`:string **RO** search/sort
- `accountId`:reference →account req filter
- `quoteId`:reference →quote
- `status`:enum req filter/sort def=`draft` — draft(neutral), sent(info), partial(warning), paid(success), overdue(danger), void(neutral)
- `currencyCode`:enum def=`USD`
- `issueDate`:date sort
- `dueDate`:date sort
- `subtotal`:currency computed
- `taxTotal`:currency computed
- `total`:currency computed sort
- `amountPaid`:currency computed
- `balance`:currency computed sort
- `notes`:text
- Lifecycle: field `status`, initial `draft`, states [draft, sent, partial, paid, overdue, void], final [paid, void]. Transitions: draft→sent `send`; draft→void `void`; sent→void `void`; overdue→void `void` (all invoice:update). (partial/paid/overdue are driven by the finance/payment service, not declared here.)

**invoiceLine** — no icon, group `finance`, `system: true`, titleField `description`, parent { invoice, invoiceId }.
- `invoiceId`:reference →invoice req filter
- `productId`:reference →product
- `description`:string req
- `qty`:number req min0 def=1
- `unitPrice`:currency req min0
- `taxRate`:percent def=0 min0 max100
- `lineTotal`:currency **computed**

#### Projects group

**project** — icon `project`, group `projects`, titleField `name`, ownable.
- `name`:string req search/sort min1 max160
- `accountId`:reference →account filter (label "Client")
- `status`:enum req filter/sort def=`planning` — planning(neutral), active(info), on_hold(warning), completed(success)
- `priority`:enum filter def=`medium` — low(neutral), medium(info), high(warning)
- `budget`:currency sort/filter min0
- `progress`:percent sort min0 max100
- `startDate`:date sort
- `dueDate`:date sort

**milestone** — icon `milestone`, group `projects`, titleField `name`, ownable. (References project but is a top-level navigable entity, not a parent/system entity.)
- `name`:string req search/sort min1 max160
- `projectId`:reference →project req filter
- `status`:enum req filter/sort def=`pending` — pending(neutral), in_progress(info), done(success)
- `amount`:currency min0
- `dueDate`:date sort

**timesheet** — icon `timesheet`, group `projects`, titleField `title`, ownable.
- `title`:string req search/sort min1 max200 (label "Description")
- `projectId`:reference →project filter
- `hours`:number req sort min0 max24
- `date`:date req sort
- `billable`:boolean filter def=true
- `status`:enum filter def=`draft` (not required) — draft(neutral), submitted(info), approved(success)

#### Marketing group

**campaign** — icon `campaign`, group `marketing`, titleField `name`, ownable, board `status`.
- `name`:string req search/sort min1 max160
- `channel`:enum req filter def=`email` — email(info), sms(neutral), social(success), whatsapp(success)
- `status`:enum req filter/sort def=`draft` — draft(neutral), scheduled(info), running(warning), completed(success), archived(neutral)
- `budget`:currency sort min0
- `sent`:number sort min0
- `startDate`:date sort
- `endDate`:date sort

#### Support group

**ticket** — icon `ticket`, group `support`, titleField `subject`, ownable, board `status`.
- `subject`:string req search/sort min1 max200
- `accountId`:reference →account filter
- `priority`:enum req filter/sort def=`medium` — low(neutral), medium(info), high(warning), urgent(danger)
- `status`:enum req filter/sort def=`open` — open(info), pending(warning), resolved(success), closed(neutral)
- `assignee`:string filter

#### People group

**department** — icon `department`, group `people`, titleField `name`. Not ownable.
- `name`:string req uniq search/sort min1 max120
- `head`:string search
- `headcount`:number sort min0

**employee** — icon `employee`, group `people`, titleField `firstName`, pluralLabel **Staff**. Not ownable.
- `firstName`:string req search/sort min1 max80 pii
- `lastName`:string req search/sort min1 max80 pii
- `email`:email search pii
- `phone`:phone pii
- `title`:string search/sort
- `departmentId`:reference →department filter
- `status`:enum filter/sort def=`active` (not required) — active(success), on_leave(warning), inactive(neutral)

#### Finance / catalog group

**product** — icon `product`, group `finance`, titleField `name`. Not ownable.
- `name`:string req search/sort min1 max160
- `sku`:string uniq search/sort
- `unitPrice`:currency req sort min0
- `currencyCode`:enum filter def=`USD` (CURRENCY_OPTIONS)
- `taxRate`:percent def=0 min0 max100
- `active`:boolean filter def=true

**currency** — icon `wallet`, group `finance`, titleField `code`. Not ownable.
- `code`:string req uniq search/sort min3 max3
- `symbol`:string req max4
- `rate`:number req min0 def=1 sort (USD per 1 unit)

**taxRate** — icon `receipt`, group `finance`, titleField `name`. Not ownable.
- `name`:string req search/sort
- `rate`:percent req min0 max100 sort
- `region`:string filter

**payment** — icon `payment`, group `finance`, titleField `number`, ownable.
- `number`:string **RO** search/sort
- `invoiceId`:reference →invoice req filter
- `accountId`:reference →account filter
- `amount`:currency req min0 sort
- `method`:enum req filter def=`bank` — bank(info), card(info), cash(neutral), other(neutral)
- `paidAt`:date req sort
- `notes`:text

**recurringPlan** — icon `recurring`, group `finance`, titleField `name`, ownable, pluralLabel **Recurring**.
- `name`:string req search/sort min1 max160
- `accountId`:reference →account req filter
- `description`:string req
- `amount`:currency req min0 sort
- `taxRate`:percent def=0 min0 max100
- `currencyCode`:enum def=`USD`
- `frequency`:enum req filter def=`monthly` — weekly, monthly, quarterly, yearly (no tones)
- `nextRun`:date req sort
- `active`:boolean filter def=true

**Shared options** (`entities/shared.ts`): `CURRENCY_OPTIONS = [USD ($), EUR (€), GBP (£), TRY (₺)]` (no tones), reused by product/quote/invoice/recurringPlan `currencyCode`.

</details>

### 7.3 How to add a new entity

To make a hypothetical `widget` (group `support`, ownable) appear and work end-to-end:

1. **Create the entity definition** — `src/lib/metadata/entities/widget.ts`:
   ```ts
   export const widgetEntity: EntityDef = {
     name: "widget", label: "Widget", pluralLabel: "Widgets",
     icon: "ticket", group: "support", titleField: "name", ownable: true,
     fields: [ /* ... */ ],
   };
   ```
   Bootstrap will throw `MetadataValidationError` if: `name`/each field `name` isn't camelCase (`/^[a-z][a-zA-Z0-9]*$/`); there are zero fields; `titleField` isn't one of the fields; an enum field has no options; a reference field's `referenceEntity` doesn't point at a registered entity; or a lifecycle's `field`/transition states are invalid; or `group` isn't one of the eight allowed values.

2. **Register in the bootstrap** — `src/lib/metadata/index.ts`: add `import { widgetEntity } from "./entities/widget";` and insert `widgetEntity` into `crmEntities` (position determines sidebar order within its group — place it next to its group's comment block). This is the single registration point; `createDraft` + `publish` run automatically at import.

3. **Zod group enum** — *only* needed for a brand-new `EntityGroup`. Edit BOTH the `EntityGroup` union in `src/lib/metadata/types.ts` AND the `group: z.enum([...])` list in `src/lib/metadata/schema.ts`; they must stay in sync. Reusing an existing group needs no schema change.

4. **Permissions** — `src/lib/permissions/policies.ts`: add `"widget:*"` / `"widget:read"` etc. to the relevant role `grants` (admin/system already cover everything via `"*"`). Without grants, no role can read/mutate the entity. If a lifecycle transition uses a custom `requires` action or mutating verb, also grant that action and add the verb to `MUTATING_VERBS` so record-level ABAC fires.

5. **Icon** — `src/components/ui/icon.tsx`: add your `icon` key to the `MAP` (and import the lucide component). Unknown keys silently fall back to `Target`, so this is optional but recommended.

6. **Seed data** *(optional)* — `src/lib/data/seed.ts`: use `mk("widget", DEMO_TENANT, DEMO_ORG, ownerId, { ...fields })` and `await repo.insert(...)`. Provide enum `value`s, reference existing seeded record `.id`s, and `null` for empty optionals. If using a finance-style number sequence, also `numberSequence.bump(...)`.

**Gotchas:** `system: true` + `parent: {...}` hides the entity from nav and treats it as a master-detail child (like quoteLine/invoiceLine) — a reference alone (e.g. milestone→project) does *not* hide it. `viewType` defaults to `table`; set `board: { groupByField }` for kanban or `calendar: { dateField }` for calendar view. `computed`/`readOnly` fields are excluded from create/update schemas and must be set server-side. Required fields with a `defaultValue` may be omitted on create (defaults applied post-validation).

Files touched to fully add an entity: `entities/<name>.ts` (new), `metadata/index.ts`, optionally `metadata/types.ts` + `metadata/schema.ts` (new group only), `permissions/policies.ts`, `components/ui/icon.tsx`, `data/seed.ts`.

---

## 8. Data Layer

### 8.1 In-memory repository & tenant partitioning

The `Repository` interface (`src/lib/data/repository.ts`) is a "dumb", tenant-scoped persistence contract; all enforcement lives above it in the query engine so adapters stay swappable.

```ts
export interface Repository {
  list(scope: TenantScope, entity: string, query: RepoQuery): Promise<Page>;
  get(scope: TenantScope, entity: string, id: string): Promise<EntityRecord | null>;
  insert(record: EntityRecord): Promise<EntityRecord>;
  update(scope: TenantScope, entity: string, next: EntityRecord, expectedVersion?: number): Promise<EntityRecord>;
  delete(scope: TenantScope, entity: string, id: string, expectedVersion?: number): Promise<void>;
  existsByField(scope: TenantScope, entity: string, field: string, value: unknown, exceptId?: string): Promise<boolean>;
  aggregate(scope: TenantScope, entity: string, query: AggregateQuery): Promise<AggregateRow[]>;
}
```

`InMemoryRepository` (`src/lib/data/memory-repository.ts`) stores `Map<entity, Map<id, EntityRecord>>`. Filtering is JS-interpreted via `matchFilter` (switch over the 8 operators); sorting applies sort keys in reverse for a stable multi-key sort. `insert` derives the collection from the id prefix (`entityFromId`: `record.id.split("_")[0]`) — ids are formatted `<entity>_<uuid>`. Extra helpers: `size(entity)` (test/seed) and `scanAll()` (system scan for search reindex).

**Tenant partitioning** is a row-level predicate, not a physical partition. Records carry `tenantId`/`orgId`; the partition unit is `TenantScope = { tenantId, orgId }`:

```ts
function scopeMatch(record: EntityRecord, scope: TenantScope): boolean {
  return record.tenantId === scope.tenantId && record.orgId === scope.orgId;
}
```

`list`, `get`, `existsByField`, and `aggregate` all gate on `scopeMatch`; `update`/`delete` resolve through `get` first. The scope comes from `scopeOf(ctx)` (`src/lib/context/isolation.ts`), and the query engine stamps `tenantId`/`orgId` from `ctx` on insert so writes can never cross tenants.

### 8.2 Optimistic concurrency (If-Match / version)

Records carry a numeric `version` (starts at 1, incremented by the engine on every write). `update`/`delete` accept an optional `expectedVersion`; a mismatch throws `ConflictError`:

```ts
if (expectedVersion !== undefined && current.version !== expectedVersion) {
  throw new ConflictError(`version conflict: expected ${expectedVersion} but found ${current.version}`);
}
```

`update` also throws `ConflictError("record no longer exists")` if the row vanished. The HTTP layer derives `expectedVersion` from the `If-Match` header via `parseIfMatch` (`src/lib/http/handler.ts`): strips quotes, `Number(...)`, returns it if finite, else `undefined`.

### 8.3 Query model

`src/lib/data/query.ts` defines:

```ts
export type FilterOperator = "eq" | "ne" | "lt" | "lte" | "gt" | "gte" | "contains" | "in";   // 8
export interface Filter  { field: string; op: FilterOperator; value: FieldValue | FieldValue[]; }
export type SortDirection = "asc" | "desc";
export interface Sort    { field: string; dir: SortDirection; }
export interface Query    { filters?: Filter[]; sort?: Sort[]; page?: number; pageSize?: number; search?: string; }
export interface RepoQuery { filters: Filter[]; sort: Sort[]; page: number; pageSize: number; search?: { term: string; fields: string[] }; }
export interface Page<T = EntityRecord> { items: T[]; total: number; page: number; pageSize: number; pageCount: number; }

export type AggregateOp = "sum" | "count" | "avg" | "min" | "max";   // 5
export interface Measure { field?: string; op: AggregateOp; as: string; }
export interface AggregateQuery { filters?: Filter[]; groupBy?: string; measures: Measure[]; }
export interface AggregateRow   { key: string | null; measures: Record<string, number>; }
```

Paging constants: `DEFAULT_PAGE_SIZE = 25`, `MAX_PAGE_SIZE = 200`. `normalizePaging` floors+clamps: `page = max(1, floor(page ?? 1))`, `pageSize = min(200, max(1, floor(pageSize ?? 25)))`.

**`parseListQuery`** (`src/lib/http/handler.ts`) parses `?q=&page=&pageSize=&sort=field:dir&filter.<field>=value`:
- `sort` — reads **all** `sort` params; splits on `:` into `{ field, dir }`; `dir` is `desc` only if exactly `"desc"`, else `asc`. Multiple `sort` params accumulate.
- `filter.<field>=value` — any key starting with `filter.` with a non-empty value emits `{ field, op: "eq", value }`. Numeric-looking strings (`/^-?\d+(\.\d+)?$/`) are coerced to Number. Only `eq` is producible from query strings.
- `q` → `query.search`; `page`/`pageSize` → `Number(...)`. Empty values are omitted.

### 8.4 The Query Engine (the single gateway)

`QueryEngine` (`src/lib/data/query-engine.ts`), constructed `(repo, metadata, permissions, clock = systemClock)`, is the only thing that touches the repository. Every operation is tenant-scoped, permission-gated, write-validated against published metadata, unique-constraint-enforced, optimistic-concurrency-protected, and field-projected:

- `list(ctx, entity, query)` — asserts `<entity>:read`, builds a `RepoQuery` (filters kept if `filterable`/known; sort kept if `sortable`; search expanded to `searchable` fields), projects each item.
- `aggregate` — asserts read, passes through (no projection on rows).
- `get` — asserts read, `assertFound`, projects.
- `create` — asserts `<entity>:create`, validates against `buildCreateSchema`, `applyDefaults`, `assertUnique`, stamps `tenantId/orgId` from ctx, `ownerId = entity.ownable ? ctx.userId : null`, `createdBy/updatedBy`, `version: 1`, timestamps from the clock.
- `update` — fetch + `assertFound`, asserts `<entity>:update` (with `recordOwnerId` for ABAC), validates with `buildUpdateSchema`, blocks direct writes to a lifecycle field unless `allowLifecycleField` (else `ConflictError` — "use a transition action"), `assertUnique(exceptId)`, re-pins immutable columns, bumps `version`/`updatedAt`/`updatedBy`, calls `repo.update(..., expectedVersion)`.
- `remove` — fetch, assert `<entity>:delete` with `recordOwnerId`, `repo.delete(..., expectedVersion)`.
- `createWithComputed` / `patchComputed` — server-only injection of computed fields (document numbers/totals). `patchComputed` skips re-validation and the permission check (used by the finance service).

Computed/system fields can never come from the client: write schemas strip them; server values arrive only via `applyDefaults` or the explicit `computed` argument.

### 8.5 IDs, clock, cache, search

- **IDs** (`src/lib/core/ids.ts`): `newId(prefix?)` → `${prefix}_${randomUUID()}` (the prefix routes the in-memory repo to a collection); `newCorrelationId()` → `cid_${uuid}`.
- **Clock** (`src/lib/core/clock.ts`): `systemClock` (wall clock) + `fixedClock(at)` for tests. The engine injects timestamps via `this.clock.isoNow()`; `ctx.at` is the single source of truth for audit timestamps.
- **Cache** (`src/lib/cache/`): `InMemoryCache` (default TTL 30,000 ms, read-through `wrap`). `registerCacheInvalidation()` subscribes to `"*"` and drops `stats:${tenantId}:` on any write in that tenant.
- **Search** (`src/lib/search/`): `InMemorySearchEngine` scores by title-includes (+3) / title-startsWith (+2) / text-includes (+1). `registerSearchIndexing()` subscribes to `"*"` (remove on `.deleted`, reindex otherwise). `search(ctx, term, opts)` filters hits by `<entity>:read` so it never leaks unreadable records.

### 8.6 The store + swap points

`src/lib/data/store.ts` builds an in-memory singleton on `globalThis.__aulaStore` (survives Next dev HMR). `getQueryEngine()` lazily seeds once via `seedInto`. To move to real backends, swap implementations behind their interfaces:

| Concern | In-memory default | Swap point | Replace with |
|---|---|---|---|
| Repository | `new InMemoryRepository()` | `store.ts:create()` | `PostgresRepository` (same `Repository` interface; `RepoQuery`/`AggregateQuery` map to WHERE/ORDER/LIMIT/GROUP BY) |
| Cache | `new InMemoryCache()` | `src/lib/cache/cache.ts` | `RedisCache` (`get/set/delete/invalidatePrefix/wrap`) |
| Event bus | `new InMemoryEventBus()` | `src/lib/workflow/event-bus.ts` | Redis/broker bus (`subscribe/publish`) |
| Search | `new InMemorySearchEngine()` | `src/lib/search/engine.ts` | OpenSearch/Typesense (`index/remove/clear/size/search`) |
| Auth | `devAuthenticator` | `setAuthenticator` in `src/lib/context/resolver.ts` | `jwtAuthenticator(secret)` (JWT/OIDC) |

Subscribers (search indexing, cache invalidation, webhooks, notifications, workflows) are wired once by `ensurePlatform()` in `src/lib/bootstrap.ts`, which also calls `reindexAll()` after seeding.

---

## 9. Permissions, Roles & Multi-Tenancy

### 9.1 RBAC roles

Roles are defined in `src/lib/permissions/policies.ts`. Grants support three wildcard shapes: global `*`, `entity:*`, and `*:verb`.

| Role | Label | Grants (summary) |
|---|---|---|
| `admin` | Administrator | `["*", "pii:read"]` — omnipotent, all PII, cross-owner mutations. |
| `system` | System | `["*", "pii:read"]` — same as admin; used by workflows/seeds/migrations (`isSystem` bypasses all checks). |
| `sales_manager` | Sales Manager | `:*` on all business entities + `pii:read`; **read-only** on `currency`/`taxRate`. Manager override on ABAC. |
| `accountant` | Accountant | Owns finance (`product:*`, `currency:*`, `taxRate:*`, `quote:*`, `quoteLine:*`, `invoice:*`, `invoiceLine:*`, `payment:*`, `recurringPlan:*`) + `pii:read`; **read-only** on CRM sales objects (`lead/account/contact/deal/task:read`) and the rest. |
| `sales_rep` | Sales Rep | Least-privileged: tenant-wide reads, **no `pii:read`**, **no `:*`** on any entity (ABAC confines mutations to owned records), no invoice/payment access, no `deal:win`. Has `lead:convert`, create/update on lead/contact/deal/task/proposal/salesOrder/timesheet/ticket. |

Key grant helpers: `grantsFor(roles)` unions grants across multiple roles; `grantMatches(grant, action)` implements wildcard matching; `canManageAny(grants, entity)` is the ABAC override (`*` or `<entity>:*` lets a user mutate records owned by others).

```ts
export const MUTATING_VERBS = new Set(["update", "delete", "win", "lose", "convert"]);
```

These verbs trigger record-level ABAC ownership checks. `create` and `read` are intentionally excluded (creates have no pre-existing owner; reads are object-level + field-level only).

### 9.2 The permission engine

`src/lib/permissions/engine.ts` produces a `Decision { allowed, reason, code }` where `DecisionCode ∈ allowed | rbac_denied | abac_denied | field_denied`. The pipeline is **fail-closed / deny-on-first-failure**:

1. **System bypass** — `ctx.isSystem` short-circuits to allow.
2. **Memoization** — keyed by `sorted-roles | userId | action | field | pii | ownershipRelation` (`na`/`unowned`/`self`/`other`), 60 s TTL, FIFO eviction at 5000 entries.
3. **RBAC (object/action)** — `grants.some(g => grantMatches(g, action))`; action is `entity:verb`. Fails → `rbac_denied`.
4. **Field-level PII** — if `field && fieldPii && !(grants.has("pii:read") || grants.has("*"))` → `field_denied`.
5. **Record-level ABAC (ownership)** — for mutating verbs on an owned record the caller does not own, denied unless `canManageAny` (manager/admin override) → `abac_denied`.

> **Note on ABAC tokens:** there are **no `$user` / `$tenant` token strings** in the codebase. ABAC is implemented by direct ownership comparison (`recordOwnerId === ctx.userId`) plus the `canManageAny` wildcard override — not a token-substitution rule language. Tenant scoping is separate (§9.5).

**PII projection** — `readableFields(ctx, entity)` returns only fields the caller may read; PII-flagged fields are dropped for callers lacking `pii:read`. All reads (`get`, every `list` item, `create`/`update` output) pass through `project(ctx, entity, record)`. Exported singleton: `permissionEngine`.

### 9.3 RequestContext & actor resolution

`RequestContext` (`src/lib/context/types.ts`) is fully `readonly` and `Object.freeze`d:

```ts
interface RequestContext {
  readonly tenantId, orgId, userId, displayName, email: string;
  readonly roles: readonly string[];
  readonly locale: string;
  readonly featureFlags: Readonly<Record<string, boolean>>;
  readonly correlationId: string;
  readonly at: string;          // request ISO timestamp; single source of truth for audit
  readonly isSystem: boolean;   // true for workflows/migrations that bypass auth
}
```

A pluggable `Authenticator` resolves the principal (`src/lib/context/resolver.ts`); the default `devAuthenticator` precedence is: (1) header `x-tenant === "t_globex"` → `OTHER_USER`; (2) actor key from header `x-actor` OR cookie `aula_actor` OR default `"admin"`; (3) `DEMO_USERS[actor] ?? DEMO_USERS.admin`. `resolveContext` runs the authenticator (throws `UnauthenticatedError` if null) and freezes the context. `systemContext(...)` builds a privileged `isSystem: true` context for workflows/seeds/migrations. Locale is `x-locale` → first `accept-language` subtag → `"en"`. Feature flags are layered system(0) < tenant(1) < org(2) < user(3).

### 9.4 Demo personas

Demo identities live in `src/lib/context/dev.ts` (`DEMO_TENANT = "t_acme"`, `DEMO_ORG = "o_acme_eu"`):

| Persona key | Name | Email | Roles |
|---|---|---|---|
| `admin` | Avery Admin | avery@acme.test | `admin` |
| `manager` | Morgan Manager | morgan@acme.test | `sales_manager` |
| `rep` | Riley Rep | riley@acme.test | `sales_rep` |
| `accountant` | Casey Accountant | casey@acme.test | `accountant` |

Plus a second tenant proving isolation: `OTHER_TENANT = "t_globex"`, `OTHER_ORG = "o_globex"`, user `OTHER_USER = u_globex_admin` (Glen Globex, `admin`). There is no `system` entry in `DEMO_USERS` — the system principal comes only from `systemContext()`.

**Switching personas:**
- **ActorSwitcher** (`src/components/crm/actor-switcher.tsx`) — header `Select` (hidden on mobile); on change sets `document.cookie = "aula_actor=<key>; path=/; max-age=31536000"` then `router.refresh()` so server + client re-resolve under the new role.
- **`x-actor` header** — API/test clients pass `x-actor: <key>`.
- **`aula_actor` cookie** — consumed by `devAuthenticator`.
- **Login page** (`src/app/login/page.tsx`) — four persona buttons call `setActorCookie(actor)` then route to `/`. Email/password fields are cosmetic (defaults `avery@aula-crm.demo` / `demo-pass`); the persona buttons + cookie are the real auth in dev. Social buttons are visual only.

Persona selection → `aula_actor` cookie → `devAuthenticator` → `DEMO_USERS[key]` → roles → live RBAC/ABAC/PII behavior change.

### 9.5 Multi-tenancy

`src/lib/context/isolation.ts`:

```ts
export function scopeOf(ctx)        { return { tenantId: ctx.tenantId, orgId: ctx.orgId }; }
export function inScope(ctx, record) { return record.tenantId === ctx.tenantId && record.orgId === ctx.orgId; }
```

`src/lib/enforcement/guards.ts` — `assertSameTenant` throws `TenantIsolationError` on mismatch ("a record from a different tenant/org is treated as if it does not exist (404), never leaking cross-tenant existence"). Isolation is enforced centrally in the query engine: every repo call receives `scopeOf(ctx)`, so `OTHER_USER` (t_globex) can never see `t_acme` data — and the seeded "Globex Internal" account is unreachable from any `t_acme` context.

### 9.6 Production auth (Phase 13)

`src/lib/security/auth.ts` provides dependency-free HS256 JWT (`signJwt`/`verifyJwt` using `node:crypto` `createHmac` + `timingSafeEqual`, `exp` check). `jwtAuthenticator(secret)` reads `Authorization: Bearer <token>`, requires `tenantId`+`orgId` claims, and maps claims to a principal. `enableJwtAuth(secret)` calls `setAuthenticator(jwtAuthenticator(secret))` — the one-line swap from dev cookies to real JWT/OIDC. Other security modules: `rate-limit.ts`, `csrf.ts`, `crypto.ts` (AES-256-GCM), `xss.ts`.

### 9.7 End-to-end summary

Net effect of the demo personas:
- **admin / system** — everything, all PII, cross-owner mutations.
- **sales_manager** — full CRUD on all business entities (manager override on ABAC), reads PII, read-only on currency/tax config.
- **accountant** — owns finance, reads PII, read-only on sales CRM objects.
- **sales_rep** — tenant-wide reads, but **no PII** (projected out), mutations limited to owned records, no invoices/payments, cannot win deals.

---

## 10. Domain & Lifecycle

### 10.1 Domain model relationships

```
Lead ──convert──▶ Account ──┬─▶ Contact (accountId)
                            ├─▶ Deal (accountId) ──▶ Task (dealId)
                            ├─▶ Project (accountId, "Client") ──┬─▶ Milestone (projectId, required)
                            │                                   └─▶ Timesheet (projectId)
                            ├─▶ Quote ──▶ quoteLine (parent)  ──convert──▶ Invoice (quoteId)
                            ├─▶ Invoice ──▶ invoiceLine (parent) ◀── Payment (invoiceId)
                            ├─▶ Proposal / Estimation / Contract / SalesOrder (accountId)
                            ├─▶ Ticket (accountId)
                            └─▶ RecurringPlan (accountId)
Department ──▶ Employee (departmentId)
Catalog: Product, Currency, TaxRate
```

Reference integrity is validated at metadata-publish time (`registry.ts` rejects refs to unknown entities). The core CRM funnel is **Account → Contact → Deal → Task**.

### 10.2 DomainService

`src/lib/domain/service.ts`, constructed `(QueryEngine, MetadataResolver, PermissionEngine, EventBus, IdempotencyStore, AuditLog)`, resolved via `getDomainService()` (caches on `globalThis.__aulaDomain` and calls `ensurePlatform()`). Events are emitted through a transactional `Outbox`.

| Method | Events emitted | Audit |
|---|---|---|
| `list` / `get` / `aggregate` | none (pure reads) | none |
| `create` | `${entity}.created` `{id, record}` | `create` |
| `update` | `${entity}.updated` `{id, record}` | `update` |
| `remove` | `${entity}.deleted` `{id}` | `delete` |
| `transition` | `${entity}.${action}` + `${entity}.stage_changed` `{id, from, to}` | `transition` (from/to) |
| `convertLead` | nested `account.created`/`contact.created`/`deal.created` + `lead.converted` | manual transition new→converted |
| `availableActions` / `auditTrail` / `recentActivity` | none | reads audit |

**`transition()`** loads the lifecycle, finds `(from, action)` via the `StateMachine` (404 → `ConflictError`), checks `transition.requires` permission, runs `runGuards(transition.guards, current)`, then writes the lifecycle field via `qe.update(..., { allowLifecycleField: true, expectedVersion })`.

**`convertLead()`** business rules: asserts `lead:convert`; `ConflictError` if already converted; `BadRequestError` if no email; reuses an account by exact name match or creates one; splits `name` into first/last; creates contact + deal (`stage: "lead"`, amount from `estimatedValue`); marks lead `converted`.

Supporting modules: `audit.ts` (in-memory append-only `AuditLog`; `AuditAction = create|update|delete|transition`), `state-machine.ts` (pure metadata-driven: `isFinal`, `transitionsFrom`, `actionsFrom`, `find`), `invariants.ts` (`INVARIANTS` registry — `amountPositive` used by deal `win`; `hasCloseDate` defined but unused).

### 10.3 Deal state machine

`lifecycle.field = "stage"`, `initial = "lead"`, `finalStates = ["won","lost"]`.

| From | To | Action | Requires | Guards |
|---|---|---|---|---|
| lead | qualified | `qualify` | `deal:update` | — |
| qualified | proposal | `propose` | `deal:update` | — |
| proposal | negotiation | `negotiate` | `deal:update` | — |
| negotiation | won | **`win`** | **`deal:win`** | **`amountPositive`** |
| lead/qualified/proposal/negotiation | lost | `lose` | `deal:update` | — |

Other lifecycles: **lead** (`new → working → qualified`, `new/working → unqualified`), **quote** (`draft → sent → accepted/declined/expired`), **invoice** (`draft → sent`, `draft/sent/overdue → void`).

### 10.4 Events & workflows

The event bus (`src/lib/workflow/event-bus.ts`) is an `InMemoryEventBus` keyed by type, dispatching to type-matched handlers **plus** `"*"` wildcard subscribers; each handler is try/caught so one bad subscriber never breaks the rest. The transactional **outbox** (`outbox.ts`) wraps delivery in `withRetry({ attempts: 3, baseMs: 20 })` and `idempotency.runOnce(event.id, ...)` for effectively-once delivery; exhausted retries mark a record `failed`. `retry.ts` does exponential backoff; `idempotency.ts` is an in-memory `Map`; `engine.ts` runs `WorkflowStep[]` in order with per-step idempotency keys.

**Concrete workflow** (`workflows.ts`, idempotent `registerWorkflows()`): a single subscriber on **`deal.win`** builds `new WorkflowEngine("deal-won", event.id)` and runs two steps:
1. `create-onboarding-task` — uses `systemContext(...)` and `qe.create` directly (not the domain service, to avoid re-emitting events) to create a `task` `{ subject: "Kick off onboarding for won deal", status: "open", dealId }`.
2. `notify-team` — logs an info line.

> `lead.converted` is emitted by `convertLead` but has **no dedicated workflow subscriber** — only the notification simulator, webhook delivery, search indexing, and cache invalidation (the `"*"` consumers) receive it.

---

## 11. Finance Module

The finance subsystem (`src/lib/finance/`) handles products, multi-currency, quotes/invoices (master-detail), payments, recurring billing, and document numbering. **It bypasses the DomainService** and writes server-computed fields directly via the query engine's `createWithComputed`/`patchComputed`, so finance operations do **not** emit domain events or write audit entries (and won't appear in `recentActivity`, webhooks, or search reindex).

### 11.1 Money, totals, sequences

- **`money.ts`** — `BASE_CURRENCY = "USD"`; `formatMoney(amount, code)` via `Intl.NumberFormat`; `toBase(amount, rate)` (rate = base units per 1 unit, e.g. EUR rate 1.08 ⇒ 1 EUR = 1.08 USD). **Note:** `FinanceService` does not currently call `toBase`; totals are computed in document currency, not normalized to base.
- **`totals.ts`** — `taxRate` is a percentage; `round2 = Math.round(n*100)/100`. `lineTotals({qty, unitPrice, taxRate})` → `{ lineSubtotal, lineTax, lineTotal }`; `docTotals(lines)` → `{ subtotal, taxTotal, total }`.
- **`number-sequence.ts`** — `NumberSequence` (in-memory `Map<"tenant:prefix", number>`): `next(tenant, prefix, pad=4)` → `"{prefix}-0001"`; `bump(tenant, prefix, n)` raises the counter so seeded docs don't collide. Prefixes: `Q` (quote), `INV` (invoice), `P` (payment).

### 11.2 FinanceService

`src/lib/finance/service.ts`, constructed `(QueryEngine, MetadataResolver, NumberSequence)`, cached on `globalThis.__aulaFinance`.

| Method | Behavior |
|---|---|
| `createDocument(ctx, entity, prefix, header)` | Assigns `number = seq.next(...)`; sets computed `{number, subtotal:0, taxTotal:0, total:0}` (+ `amountPaid:0`/`balance:0` if present); `createWithComputed`. |
| `getDocument(ctx, entity, lineEntity, parentField, docId)` | Header + lines (filtered by `parentField=docId`, pageSize 200). |
| `replaceLines(...)` | Deletes existing child lines, recreates each with computed `lineTotal`, recomputes `docTotals`, patches totals (+ recomputes `balance` if present). |
| `saveDocument(...)` | Updates header (non-computed), then `replaceLines`, returns `getDocument`. |
| `listPayments(ctx, invoiceId)` | `payment` filtered by `invoiceId`, sorted `paidAt asc`. |
| `applyPayment(ctx, invoiceId, input)` | Creates `payment` (`number = seq.next(..., "P")`, copies `accountId`), then `recomputeInvoice`. |
| `recomputeInvoice(ctx, invoiceId)` | Sums payments → `amountPaid`; `balance = round2(total - amountPaid)`; status: stays `void`; else `paid` when `balance<=0 && total>0`; else `partial` when `amountPaid>0`. |
| `convertQuoteToInvoice(ctx, quoteId)` | Creates a draft invoice copying accountId/currency/notes + `quoteId` link, `issueDate = ctx.at[0:10]`, `dueDate = +30d`; copies lines. **Note:** does *not* enforce the quote being `accepted` despite the comment. |
| `generateDueInvoices(ctx, today?)` | For each active `recurringPlan` with `nextRun <= today`: creates a draft invoice (one line, due +30d), advances `nextRun` by frequency, returns generated ids. |
| `markOverdue(ctx, today?)` | Scans up to 500 invoices; for `sent`/`partial` with `balance > 0` and `dueDate < today` → `patchComputed { status: "overdue" }`; returns count. |

### 11.3 Master-detail, routes, print/PDF

Line items are **system entities** (`quoteLine`, `invoiceLine` — hidden from nav, `parent: {entity, field}`). Dedicated frontend routes override the generic `[entity]` page (Next resolves literal segments first): `quote/` and `invoice/` list pages (server, `force-dynamic`, money-formatted), `quote/[id]` and `invoice/[id]` (`DocumentEditor` master-detail; quote sets `convert`, invoice sets `showPayments`), and `[id]/print` (server-rendered `DocumentPrint`). Finance API: `/quotes` (+ `[id]`, `[id]/convert`), `/invoices` (+ `[id]`, `[id]/payments`), `/recurring/run`, `/cron/tick`.

**Print / PDF** — `src/components/crm/document-print.tsx` renders a branded document (letterhead, Bill To, line table, totals, "Balance Due" when `doc.balance` is a number) with a `no-print` "Print / Save PDF" button calling `window.print()`. PDF is produced via the browser's Print → Save as PDF. Print CSS (`globals.css`, `@media print`) hides `nav`/`header`/`.no-print` and expands `main`.

### 11.4 Finance dashboard

The `/finance` route (server, `force-dynamic`) provides a finance overview (payments/revenue); reports live under `/reports/{revenue,sales,...}`.

---

## 12. Automation & Integrations

Bootstrap: `getDomainService()` calls `ensurePlatform()` (`src/lib/bootstrap.ts`) after the store is seeded, wiring (in order, each self-guarded against double-subscription): `seedFeatureFlags` → `registerWorkflows` → `registerSearchIndexing` → `registerCacheInvalidation` → `registerWebhookDelivery` → `registerNotifications` → `reindexAll`.

### 12.1 Webhooks

`src/lib/integrations/webhooks.ts` — tenant + org-scoped endpoints subscribing to domain event types, delivered HMAC-signed with retry, logged in a capped in-memory delivery log.

- **Shapes:** `WebhookEndpoint { id, tenantId, orgId, url, secret, events[], createdAt }`; `WebhookDelivery { id, endpointId, tenantId, orgId, at, type, ok, status, error? }`.
- **`webhookRegistry`** (plain in-memory arrays, *not* `globalThis`-pinned — resets on reload, cap 200 deliveries): `register`, `remove`, `get`, `list`, `matching(event)` (tenant+org match AND `events` includes `"*"` or the exact type), `recordDelivery`, `listDeliveries`.
- **HMAC signing:** `signWebhook(body, secret) = createHmac("sha256", secret).update(body).digest("hex")`, sent as `x-aula-signature: sha256=<hex>` alongside `x-aula-event: <type>`. Body is `JSON.stringify({ id, type, at, payload })`.
- **Delivery:** `deliver` wraps `fetch` POST in `withRetry({ attempts: 3, baseMs: 100 })`; non-2xx throws to retry; success/final-failure both `recordDelivery`. Delivery is synchronous within `eventBus.publish`.
- **Test/ping:** `testWebhook(endpoint, at)` builds a synthetic `type: "ping"` event and runs the normal `deliver` path (signed, retried, logged).
- **Live subscription:** `registerWebhookDelivery()` subscribes a single `"*"` handler.
- **Echo receiver:** `POST /api/v1/webhooks/echo` reads `x-aula-signature` and returns `{ received: true, signature }`. It does **not** verify the HMAC — it only echoes (default placeholder URL `http://localhost:3000/api/v1/webhooks/echo`).
- **API (all admin-gated except echo):** `GET/POST /webhooks`, `DELETE /webhooks/[id]`, `POST /webhooks/[id]/test`.
- **UI:** `WebhookManager` (`automation-admin.tsx`) — add/list/test/delete + recent deliveries with ok/fail badge.

### 12.2 Notifications

`src/lib/integrations/notifications.ts` — an in-memory inbox simulating email/system sends that populates the topbar bell. `Notification { id, at, tenantId, orgId, channel: "email"|"system", subject, body, eventType, read }`; capped at 300, tenant+org-scoped. `registerNotifications()` subscribes to exactly **4 topics**:

| Topic | Channel | Subject |
|---|---|---|
| `quote.send` | email | Quote sent |
| `invoice.send` | email | Invoice sent |
| `deal.win` | system | Deal won 🎉 |
| `lead.converted` | system | Lead converted |

These topics are published by domain/finance state transitions. **Topbar bell** (`NotificationsBell`, mounted in `shell-client.tsx`) polls `GET /notifications` on mount and every 20 s, shows a red unread badge, and marks-all-read on open via `POST /notifications`. The notifications API is **not** admin-gated (every user has a bell).

### 12.3 Scheduler & cron

`src/lib/jobs/scheduler.ts` — two daily `JOBS`:

| Job | Action |
|---|---|
| `billing-run` (Recurring billing) | `FinanceService.generateDueInvoices(ctx)` → "<n> invoice(s) generated" |
| `mark-overdue` (Mark overdue invoices) | `FinanceService.markOverdue(ctx)` → "<n> invoice(s) marked overdue" |

`runAllJobs(ctx)` runs each (per-job failure captured, one failure doesn't abort the rest) into a `JobRunLog`; `jobsStatus()` feeds the Automation screen. **Cron endpoint:** `POST /api/v1/cron/tick` (admin-gated) calls `runAllJobs`. Triggered by an external scheduler or the "Run now" button (`RunJobsButton`).

The **/automation screen** (server, `force-dynamic`) shows three admin cards: Scheduled jobs (+ Run now), recent Notifications, and the Webhooks manager. Non-admins see an "Administrators only" empty state.

### 12.4 Integration adapters

`src/lib/integrations/adapters.ts` is a pluggable extensibility/swap point for **outbound integrations** (CRM sync, email, messaging) layered on the event bus — distinct from webhooks (HTTP delivery) and notifications (in-app inbox):

- **`IntegrationAdapter { name, events: string[], handle(event) }`** — an adapter declares the event types it reacts to (`"*"` for all) and an async `handle`.
- **`AdapterRegistry`** (singleton `adapterRegistry`) — `enable(adapter)` registers the adapter and subscribes it to the event bus for each of its `events` types (logging `"integration adapter enabled"`); `list()` returns the enabled adapter names. (Unsubscribers are retained internally.)
- **Bundled example: `dealWonNotifier`** — an adapter on `["deal.win"]` that logs `"[integration] deal won"` with the deal id. It is shipped as a sample and is **not** enabled by default in `ensurePlatform()`; call `adapterRegistry.enable(dealWonNotifier)` (or your own adapter) to wire it.

### 12.5 Configuration & feature flags (Phase 14)

Two cooperating modules implement layered configuration and named feature flags.

**`src/lib/config/feature-flags.ts`** declares the named flags and their defaults:

```ts
export const FEATURE_FLAGS = {
  metadataGovernance: true,
  csvExport:          true,
  globalSearch:       true,
  betaForecast:       false,
} as const;
```

- `isEnabled(ctx, flag)` resolves a flag for a request: `ctx.featureFlags[flag] ?? FEATURE_FLAGS[flag]` (the context's resolved value wins, falling back to the default).
- `seedFeatureFlags()` (idempotent) writes the defaults into the system config layer via `configStore.setSystem({ features: { ...FEATURE_FLAGS } })`. It runs **first** in `ensurePlatform()` (and is also invoked eagerly at module import so contexts resolved before platform boot still see defaults).

**`src/lib/context/config.ts`** provides the reusable `ConfigStore` (singleton `configStore`) — a layered config hierarchy with precedence **system (0) < tenant (1) < org (2) < user (3)**; the most specific layer wins:

- Writers: `setSystem(values)`, `setTenant(tenantId, values)`, `setOrg(orgId, values)`, `setUser(userId, values)` (each merges into the existing layer).
- Readers: `resolve({ tenantId, orgId, userId })` merges all applicable layers into one object; `get(scopeKeys, key, fallback)` reads a single key; `featureFlags(scopeKeys)` merges the reserved `features` config key across layers into `Record<string, boolean>`. Convenience: `flagsFor(store, ctx)`.

Feature flags are thus just a reserved `features` config key resolved through the same precedence chain that drives `ctx.featureFlags` (see §9.3).

### 12.6 Governance, releases & migrations (Phase 14)

Three modules under `src/lib/config/` form the metadata-governance + release + migration trio (all exported from the `config` barrel):

- **`governance.ts`** — `publishMetadata(ctx, version, note?)` and `rollbackMetadata(ctx, toVersion, note?)` wrap `metadataRegistry.publish(...)` with an authorization gate (`assertCanGovern`: `ForbiddenError` unless `ctx.isSystem` or `ctx.roles` includes `"admin"`) and append a record to the release trail. These back `POST /api/v1/admin/metadata/republish`.
- **`release.ts`** — `ReleaseLog` (singleton `releaseLog`) is an in-memory who/when/what audit trail. `record(ctx, { kind, version?, note? })` appends a `ReleaseRecord { id, at, actor, kind, version?, note? }` (id `rel_<uuid>`, `at`/`actor` from `ctx`); `list()` returns newest-first. `ReleaseKind` = `metadata_publish | rollback | migration`. It backs `GET /api/v1/admin/releases`.
- **`migrations.ts`** — `MigrationRunner` (singleton `migrationRunner`) is a **forward-only, idempotent** migration ledger. `MIGRATIONS` is the in-code ledger (`0001_init` "Create core CRM tables", `0002_audit` "Add audit_log and outbox tables"); `pending()`/`appliedIds()` report state and `apply(ctx)` runs every pending migration, marking it applied and recording a `migration` entry in the release trail.

> **No on-disk `migrations/` directory exists yet.** The module comment mentions mapping migrations to SQL files under `migrations/` for a PostgreSQL backend, but those SQL files are a future concern and are **not present in the repo** — today the only ledger is the in-code `MIGRATIONS` array. When provisioning the PostgreSQL backend (§20), add the on-disk SQL migrations and have a real runner consult this ledger.

---

## 13. API Reference

Base path: `/api/v1`. 29 route files. Every route except `export/[entity]`, `webhooks/echo`, and `health` runs through `runApi(req, fn, opts)` (`src/lib/http/handler.ts`), which resolves context, rate-limits, enforces CSRF on mutations, runs the handler, and serializes data/errors.

### 13.1 Conventions

- **Authentication / context:** `x-actor` header (or `aula_actor` cookie) selects the dev principal (default `admin`); `x-tenant: t_globex` switches tenant; `x-locale`/`accept-language` set locale; `x-correlation-id` is echoed (or generated). Missing principal → `UnauthenticatedError` (401).
- **Mutations** (`opts.mutating: true`): double-submit CSRF (when the CSRF cookie is present, header must match or `ForbiddenError` 403); `If-Match` → numeric `expectedVersion` via `parseIfMatch`; create endpoints return 201.
- **Rate limiting:** per `userId:path`, default 240 req / 60 s → `RateLimitError` (429).
- **List query params:** `?q=`, `?page=`, `?pageSize=`, repeatable `?sort=field:asc|desc`, `?filter.<field>=value`.
- **Dynamic params are Promises (Next 16):** handlers do `const { entity, id } = await ctx.params;`. Unknown entities → `NotFoundError` (404).
- **Response headers** (`jsonResponse`): always `x-api-version: 1`; `x-correlation-id` when available; CSV export adds `content-type: text/csv` + `content-disposition`.
- **Error shape** (`SerializedError`):
  ```json
  { "error": { "code": "...", "message": "...", "details": [{ "field": "...", "message": "..." }], "correlationId": "..." } }
  ```
  `ErrorCode` → HTTP: `VALIDATION` 422, `UNAUTHENTICATED` 401, `FORBIDDEN` 403, `TENANT_ISOLATION` 404 (masked "Resource not found"), `NOT_FOUND` 404, `CONFLICT` 409, `RATE_LIMITED` 429, `BAD_REQUEST` 400, `INTERNAL` 500 (masked, not exposed). Non-`AppError`s are wrapped as `INTERNAL` via `toAppError`. 500s are logged with correlationId; `api.requests`/`api.errors` metrics are incremented.
- **Role gating:** admin-only routes throw `ForbiddenError` when `rc.roles` lacks `"admin"`: `admin/releases`, all `webhooks`, `cron/tick`.

### 13.2 Endpoints

<details>
<summary><strong>Full endpoint list (29 route files)</strong></summary>

| Method | Path | Purpose |
|---|---|---|
| GET / POST | `/api/v1/entities/[entity]` | List (paginated/filtered) / create (201) |
| GET / PATCH / DELETE | `/api/v1/entities/[entity]/[id]` | Read / optimistic update (If-Match) / optimistic delete |
| GET / POST | `/api/v1/entities/[entity]/[id]/transitions` | List available actions / perform one (`{ action }`, If-Match) |
| GET | `/api/v1/entities/[entity]/[id]/audit` | Per-record audit trail |
| GET | `/api/v1/meta` | All entity metadata + version |
| GET | `/api/v1/meta/[entity]` | Single entity metadata |
| POST | `/api/v1/aggregate` | Grouped aggregation (`{ entity, groupBy?, measures[], filters? }`) |
| GET | `/api/v1/stats` | Dashboard counts + pipeline-by-stage (cached 30 s) |
| GET | `/api/v1/activity` | Tenant-wide recent activity (latest 12) |
| GET | `/api/v1/search` | Global tenant-scoped search (`?q=` + repeatable `?entity=`, limit 20) |
| GET | `/api/v1/export/[entity]` | CSV export (`text/csv` attachment; bespoke handler) |
| POST | `/api/v1/import/[entity]` | CSV import (`{ csv }`) |
| POST | `/api/v1/invoices` | Create invoice header + optional lines (201) |
| GET / PUT | `/api/v1/invoices/[id]` | Header + lines / save header + lines |
| GET / POST | `/api/v1/invoices/[id]/payments` | List payments / record payment (`amount>0` + `paidAt`, 201) |
| POST | `/api/v1/quotes` | Create quote header + optional lines (201) |
| GET / PUT | `/api/v1/quotes/[id]` | Header + lines / save header + lines |
| POST | `/api/v1/quotes/[id]/convert` | Convert quote → draft invoice (`{ invoiceId }`, 201) |
| POST | `/api/v1/leads/[id]/convert` | Convert lead → account + contact + deal |
| POST | `/api/v1/recurring/run` | Billing run: generate due recurring invoices |
| POST | `/api/v1/cron/tick` | Run all scheduled jobs (**admin-only**) |
| GET / POST | `/api/v1/webhooks` | List endpoints + deliveries / register (`url` required, 201) — **admin-only** |
| DELETE | `/api/v1/webhooks/[id]` | Remove endpoint (**admin-only**, 404 if missing) |
| POST | `/api/v1/webhooks/[id]/test` | Send synthetic ping (**admin-only**) |
| POST | `/api/v1/webhooks/echo` | Local demo receiver (echoes signature; **unauthenticated**, no `runApi`) |
| GET / POST | `/api/v1/notifications` | List items + unread / mark all read |
| POST | `/api/v1/admin/metadata/republish` | Governed metadata re-publish |
| GET | `/api/v1/admin/releases` | Release audit trail + migrations (**admin-only**) |
| GET | `/api/v1/health` | Status, metadata version, backend mode, metrics (raw `jsonResponse`, no auth) |

</details>

---

## 14. Screens & Routes

**Total: 50 `page.tsx` files + `not-found.tsx` + root `layout.tsx`.** Legend: **[C]** `"use client"`, **[S]** server component, **[FD]** `force-dynamic`, **[CHROMELESS]** full-bleed (no sidebar/header).

The CHROMELESS set (`shell-client.tsx`): `/login`, `/register`, `/forgot-password`, `/reset-password`, `/lock-screen`, `/email-verification`, `/two-step-verification`, `/coming-soon`, `/under-maintenance`. Everything else renders inside the app chrome.

**Rendering breakdown:** 17 client pages (none `force-dynamic`), 28 `force-dynamic` server pages, and 5 static server pages (`settings/{security,notifications,appearance,roles}` **and** `/file-manager`) — 17 + 28 + 5 = 50 — plus `not-found.tsx`.

<details>
<summary><strong>Full route list (grouped)</strong></summary>

#### Generic metadata-driven entity
| Route | Type | Notes |
|---|---|---|
| `/[entity]` | [S][FD] | Catch-all: resolves any registered entity, lists records (25/page), renders `EntityView` (+ `?focus=` drawer); 404 on unknown entity |

#### Dashboards
| Route | Type | Notes |
|---|---|---|
| `/` | [S][FD] | Main dashboard: KPI stats, pipeline bar chart, deals donut, top deals, recent activity |
| `/sales-dashboard` | [S][FD] | Sales dashboard |
| `/leads-dashboard` | [S][FD] | Leads dashboard |
| `/deals-dashboard` | [S][FD] | Deals dashboard |
| `/project-dashboard` | [S][FD] | Projects dashboard |
| `/executive-dashboard` | [S][FD] | Executive summary |
| `/revenue-dashboard` | [S][FD] | Revenue dashboard |
| `/growth-dashboard` | [S][FD] | Growth metrics |

#### Auth (all CHROMELESS)
| Route | Type | Notes |
|---|---|---|
| `/login` | [C][CHROMELESS] | Sign-in + persona buttons |
| `/register` | [C][CHROMELESS] | Registration |
| `/forgot-password` | [C][CHROMELESS] | Request reset link |
| `/reset-password` | [C][CHROMELESS] | Set new password |
| `/lock-screen` | [C][CHROMELESS] | Locked-session re-entry |
| `/email-verification` | [C][CHROMELESS] | Email confirmation |
| `/two-step-verification` | [C][CHROMELESS] | 2FA / OTP |

#### Errors / utility
| Route | Type | Notes |
|---|---|---|
| `not-found.tsx` (404) | [S, static] | Self-contained `min-h-screen` 404 |
| `/error-500` | [C] | 500 page (not in CHROMELESS array) |
| `/coming-soon` | [C][CHROMELESS] | Placeholder |
| `/under-maintenance` | [C][CHROMELESS] | Maintenance mode |

#### Communication
| Route | Type | Notes |
|---|---|---|
| `/email` | [C] | Email client |
| `/chat` | [C] | Chat UI |
| `/calls` | [C] | Call log / dialer |
| `/file-manager` | [S, static] | Document browser (static server component — hardcoded placeholder folders/files; no `force-dynamic`) |
| `/social-feed` | [C] | Social feed |
| `/todo` | [C] | To-do list |
| `/notes` | [C] | Notes app |

#### Sales / finance dedicated
| Route | Type | Notes |
|---|---|---|
| `/pipeline` | [S][FD] | Deal Kanban by stage |
| `/quote` | [S][FD] | Quotes list |
| `/quote/[id]` | [S][FD] | Quote editor (master-detail) |
| `/quote/[id]/print` | [S][FD] | Printable quote |
| `/invoice` | [S][FD] | Invoices list |
| `/invoice/[id]` | [S][FD] | Invoice editor |
| `/invoice/[id]/print` | [S][FD] | Printable invoice |
| `/finance` | [S][FD] | Finance overview |

#### Reports
| Route | Type | Notes |
|---|---|---|
| `/reports` | [S][FD] | Reports hub |
| `/reports/deals` | [S][FD] | Deals report |
| `/reports/leads` | [S][FD] | Leads report |
| `/reports/sales` | [S][FD] | Sales report |
| `/reports/revenue` | [S][FD] | Revenue report |
| `/reports/projects` | [S][FD] | Projects report |

#### Settings
| Route | Type | Notes |
|---|---|---|
| `/settings` | [S][FD] | Settings index |
| `/settings/profile` | [S][FD] | Profile |
| `/settings/security` | [S, static] | Sessions / password |
| `/settings/notifications` | [S, static] | Notification prefs |
| `/settings/appearance` | [S, static] | Theme / density |
| `/settings/roles` | [S, static] | Role/permission matrix (reads `ROLES`) |
| `/settings/users` | [C][FD] | User management |

#### Calendar / activity / automation
| Route | Type | Notes |
|---|---|---|
| `/calendar` | [S][FD] | Calendar of tasks/deals |
| `/activity` | [S][FD] | Activity timeline |
| `/automation` | [S][FD] | Webhooks + notifications + scheduler admin |

</details>

The shell source of truth is `src/components/crm/shell-client.tsx` (the `CHROMELESS` constant governs which routes skip the sidebar/header).

---

## 15. UI & Theming

### 15.1 The CRMS red design-token system

`src/app/globals.css` uses Tailwind v4 (`@import "tailwindcss"`) with `@custom-variant dark (&:where(.dark, .dark *))` for **class-based dark mode** (the toggle can override the OS). `@theme inline` maps every `--*` token to a Tailwind utility. The accent is the CRMS red.

**Light tokens (`:root`):**

| Token | Value | Token | Value |
|---|---|---|---|
| `--background` | `#f6f7f9` | `--primary` | `#e41f07` |
| `--surface` | `#ffffff` | `--primary-foreground` | `#ffffff` |
| `--surface-2` | `#f1f3f5` | `--primary-hover` | `#c2380b` |
| `--foreground` | `#111418` | `--secondary` | `#6238c3` |
| `--muted` | `#5b6573` | `--success` | `#0ba259` |
| `--muted-2` | `#8a93a2` | `--warning` | `#ff9f43` |
| `--border` | `#e3e6ea` | `--danger` | `#e70d0d` |
| `--border-strong` | `#cdd2d9` | `--info` | `#1b84ff` |
| `--ring` | `#e41f07` | `--radius` | `0.5rem` (`--radius-sm` `0.375rem`) |

**Dark tokens (`.dark`):**

| Token | Value | Token | Value |
|---|---|---|---|
| `--background` | `#0b0d11` | `--primary` | `#fb4b2a` |
| `--surface` | `#14171c` | `--primary-foreground` | `#ffffff` |
| `--surface-2` | `#1b1f26` | `--primary-hover` | `#ff6b4d` |
| `--foreground` | `#e9ecf1` | `--secondary` | `#9b7ce8` |
| `--muted` | `#9aa3b2` | `--success` | `#22c55e` |
| `--muted-2` | `#6b7484` | `--warning` | `#ff9f43` |
| `--border` | `#262b33` | `--danger` | `#ff4d4d` |
| `--border-strong` | `#353c46` | `--info` | `#3b82f6` |
| `--ring` | `#fb4b2a` | (radius inherits from `:root`) | |

Shadows are defined at three levels (`--shadow-sm/md/lg`) per mode. Other rules: `:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }` (WCAG 2.4.7); `@media (prefers-reduced-motion: reduce)` zeroes animations; thin themed scrollbars; `@media print` hides `nav`/`header`/`.no-print` for clean document printing.

**Root layout** (`src/app/layout.tsx`): title "Aula CRM", Geist Sans/Mono, a `NO_FLASH` IIFE in `<head>` that reads `aula_theme` and toggles `.dark` before paint, a server-read theme cookie passed to `ThemeProvider`, a skip-link to `#main-content`, and the sonner `<Toaster richColors position="top-right" closeButton>`.

### 15.2 The shell

- **`app-shell.tsx`** (server) — builds nav from `metadata.listEntities()` (minus `system`) + `NAV_EXTRAS`; reads `aula_sidebar` (collapsed) and resolves the actor persona; passes items/displayName/actorKey to `ShellClient`.
- **`shell-client.tsx`** (client) — flex layout: `Sidebar` + `MobileNav` + `CommandPalette` + sticky header (`bg-surface/80 backdrop-blur-sm`) with mobile menu button, search trigger (`⌘K` kbd), `NotificationsBell`, `ThemeToggle`, `ActorSwitcher`, displayName. Global `Cmd/Ctrl+K` listener; `CHROMELESS` array bypasses chrome.
- **`sidebar.tsx`** — grouped nav. `GROUP_ORDER = [dashboards, crm, sales, projects, marketing, support, people, finance, comms, admin]`; pinned "Dashboard" link; active = `bg-primary/10 text-primary` + `aria-current`; collapse toggle (`w-56` ↔ `w-16`).
- **`command-palette.tsx`** — modal opened by `Cmd/Ctrl+K`; debounced (180 ms) record search via `/search?q=` (≥2 chars) combined with nav commands; arrow/Enter/Escape navigation.
- **`theme-provider.tsx` / `theme-toggle.tsx`** — `Theme = light|dark|system`; toggle cycles light→dark→system (Sun/Moon/Monitor); persists to `aula_theme` cookie + localStorage; subscribes to `matchMedia` when `system`.
- Plus `notifications-bell.tsx`, `actor-switcher.tsx`, `mobile-nav.tsx`, `breadcrumbs.tsx`.

Cookies used by the UI: `aula_theme`, `aula_sidebar`, `aula_actor`.

### 15.3 Component catalog

<details>
<summary><strong>All ui/ primitives and crm/ components</strong></summary>

#### `components/ui/`
| Component | Notes |
|---|---|
| `button.tsx` | Variants primary/secondary/outline/ghost/danger; sizes xs/sm/md; `loading` shows spinner + disables |
| `card.tsx` | `Card`, `CardHeader` ({title, action}), `CardBody` |
| `badge.tsx` | `Badge` + `Tone` (neutral/info/success/warning/danger); pill shape |
| `input.tsx` | `Input`, `Textarea`, `Select`, `Label`; `invalid` prop sets `aria-invalid`; `Label` `required` adds red `*` |
| `tabs.tsx` | `Tabs` ({items, value, onChange}); `role=tablist/tab`, `aria-selected` |
| `drawer.tsx` | Right-side panel `max-w-md`; `role=dialog aria-modal`; Escape + backdrop close; optional footer |
| `dropdown-menu.tsx` | `DropdownMenu` (render-prop trigger, align start/end) + `MenuItem` (danger variant) |
| `icon.tsx` | `Icon` wraps lucide via `MAP`; unknown keys fall back to `Target` |
| `skeleton.tsx` | `animate-pulse` placeholder |
| `spinner.tsx` | lucide `Loader2 animate-spin` |
| `empty-state.tsx` | Centered icon chip + title/description + optional action |
| `table.tsx` | `Table`/`THead`/`TH`/`TR`/`TD` primitives |

#### `components/crm/`
| Component | Notes |
|---|---|
| `app-shell.tsx` / `shell-client.tsx` | Server nav builder + client chrome |
| `sidebar.tsx` / `mobile-nav.tsx` | Grouped desktop sidebar + off-canvas mobile drawer |
| `command-palette.tsx` | `⌘K` search palette |
| `breadcrumbs.tsx` | Crumb trail |
| `entity-view.tsx` | Top-level list orchestrator (toolbar + table/board + pagination + drawers) |
| `data-table.tsx` | Data-dense server table (sortable headers, skeleton rows, mobile card list) |
| `table-toolbar.tsx` | Search + enum filters + Export link + New button |
| `pagination.tsx` | Range + rows-per-page + prev/next |
| `record-drawer.tsx` | Detail drawer: Details/Activity/Related tabs; inline edit (PATCH + If-Match); transitions; lead Convert; two-step delete |
| `create-drawer.tsx` | "New {label}" form (POST) |
| `field-input.tsx` | Metadata-driven control per field type |
| `value-cell.tsx` / `field-format.ts` | Cell rendering (`Badge` for enums) + formatters |
| `kanban-board.tsx` | Board from `board.groupByField`; drag = lifecycle transition |
| `calendar-view.tsx` | Month grid of tasks/deals |
| `dashboard-charts.tsx` | recharts `PipelineBarChart` + `StageDonut` |
| `document-editor.tsx` | Quote/invoice master-detail editor |
| `line-items-editor.tsx` | Editable line grid (`EditableLine`, `emptyLine`) |
| `document-print.tsx` | Printable doc (browser Print → PDF) |
| `payments-panel.tsx` | List + record payments |
| `run-recurring-button.tsx` | `POST /recurring/run` |
| `settings-admin.tsx` | `RepublishButton` + `ImportForm` |
| `automation-admin.tsx` | `RunJobsButton` + `WebhookManager` |
| `notifications-bell.tsx` | Topbar bell (polls every 20 s) |
| `actor-switcher.tsx` | Demo persona select |

</details>

All client API calls go through `apiFetch` (`src/lib/api-client.ts`); errors are `ApiRequestError` exposing `fieldErrors()` for per-field form errors.

---

## 16. CRUD Operations

CRUD flows end-to-end through the generic data table + drawers, the REST API, and the query engine:

- **Create** — `CreateDrawer` ("New {label}") renders a `FieldInput` per editable field (excludes `readOnly`/`computed`/lifecycle field), then `POST /api/v1/entities/{name}`. Field-level errors come from `ApiRequestError.fieldErrors()`.
- **Read** — `RecordDrawer` (keyed/remounted per record, opened via `?focus=`) loads detail + transitions + audit in parallel; **Details / Activity / Related** tabs. Details shows a read-only `dl` of all readable fields (PII already projected out server-side).
- **Update** — in `RecordDrawer`, the "Edit" button (shown when `canUpdate`) reveals an inline form that `PATCH`es `/entities/{name}/{id}` with an `if-match: <version>` header for optimistic concurrency; per-field errors are surfaced inline. `editableFields()` excludes `readOnly`/`computed` and the lifecycle field.
- **Delete** — two-step confirm in the drawer footer (Delete → Confirm delete), then `DELETE` with `if-match: <version>`.
- **Lifecycle transition** — both the transition buttons (record drawer + document editor) and **Kanban drag-and-drop** map to `POST /entities/{name}/{id}/transitions { action }`. The kanban board looks up the matching `from → to` transition; an illegal move errors ("Can't move…"). Lifecycle is the single source of truth for status changes.
- **Lead convert** — when `entity.name === "lead"` and status ≠ converted, a Convert button `POST`s `/leads/{id}/convert`.

**Client-side state note:** The communication and utility screens (`email`, `chat`, `calls`, `social-feed`, `todo`, `notes`, `settings/users`, `error-500`, and the auth/utility pages) are `"use client"` components using client-side state and are presentation-focused; the metadata-driven entity pages and dashboards are server components (`force-dynamic`) that fetch through the domain/API layer.

---

## 17. Testing

Run the suite:

```bash
npm test
```

This runs `node --experimental-transform-types --import ./tests/register.mjs --test "tests/**/*.test.ts"` — the native **`node:test`** runner with experimental TS type-stripping (no Jest/Vitest). The pieces:

- **`--experimental-transform-types`** — Node strips TypeScript syntax at runtime so `.ts` test files run without a compile step.
- **`tests/register.mjs`** — registers the resolve hook: `register("./resolve-hook.mjs", import.meta.url)`.
- **`tests/resolve-hook.mjs`** — a dependency-free ESM `resolve` hook that maps the `@/` alias to `src/` and adds extensions (`.ts`, `.tsx`, `.js`, `/index.ts`, `/index.tsx`) for extensionless relative imports (type-stripping handles TS syntax; this only fixes module resolution).
- **`tests/helpers.ts`** — `makeCtx()` fabricates a `RequestContext` (tenant `t_test`, org `o_test`); `buildStack()` wires an isolated in-memory stack (InMemoryRepository, QueryEngine, InMemoryEventBus, IdempotencyStore, AuditLog, DomainService).

**Coverage summary — 34 tests, 34 pass, 0 fail (~2.2 s):**

| File | Tests | Covers |
|---|---|---|
| `metadata.test.ts` | 4 | Zod entity validation, resolver lists published CRM entities, create-schema required+defaults |
| `permissions.test.ts` | 3 | RBAC (admin vs rep win deal), ABAC (own vs other), field-level PII denial |
| `query-engine.test.ts` | 7 | CRUD, read-only denial, tenant isolation, ABAC mutate block, optimistic-concurrency conflict, unique constraint, PII projection |
| `domain-lifecycle.test.ts` | 4 | State machine win + event + audit, action-permission denial, zero-amount invariant, illegal transition |
| `aggregate.test.ts` | 2 | sum+count grouped by stage, tenant isolation |
| `finance.test.ts` | 4 | Line tax totals, document totals, number sequence per tenant+prefix, currency conversion |
| `finance-doc.test.ts` | 1 | Create quote, replace lines, compute totals+number |
| `invoice-payment.test.ts` | 2 | Payments update balance/status, quote→draft-invoice line copy |
| `lead.test.ts` | 2 | Lead conversion, requires email |
| `recurring.test.ts` | 1 | Recurring billing generates due invoices, advances nextRun |
| `security.test.ts` | 4 | JWT round-trip/tamper, AES-GCM round-trip, CSRF double-submit, rate-limiter blocks past limit |

**E2E:** `tests/e2e/` (`playwright.config.ts`, `crm.spec.ts`) uses `@playwright/test`, baseURL `http://localhost:3000`, webServer `npm run dev`. It is **excluded** from `npm test` (glob is `tests/**/*.test.ts`; e2e uses `.spec.ts`) and from tsconfig (`exclude: ["tests/e2e"]`). `@playwright/test` is **not** in package.json. The run emits experimental warnings and a `MODULE_TYPELESS_PACKAGE_JSON` warning (no `"type": "module"`).

---

## 18. Tooling Gotchas

- **Next 16 middleware is `proxy.ts`** — not `middleware.ts`. `src/proxy.ts` exports `proxy(req)` + `config`. It calls `NextResponse.next()`, sets hardening headers (`x-content-type-options: nosniff`, `x-frame-options: DENY`, `referrer-policy: strict-origin-when-cross-origin`, `permissions-policy: camera=(), microphone=(), geolocation=()`), and sets a 24-byte hex `aula_csrf` double-submit cookie (sameSite `lax`, path `/`) if absent. It is self-contained / edge-safe. `config.matcher = ["/((?!_next/static|_next/image|favicon.ico).*)"]`.
- **Async params / headers (Next 16)** — every dynamic route handler does `const { entity, id } = await ctx.params;` (params is a `Promise`), and context resolution reads `headers()` asynchronously.
- **Tailwind v4** — configured purely via the PostCSS plugin (`postcss.config.mjs` → `{ "@tailwindcss/postcss": {} }`); there is **no `tailwind.config` file**. Tokens are defined in `globals.css`.
- **Test transform + resolve hook** — `--experimental-transform-types` strips TS; the custom `resolve-hook.mjs` maps `@/` and adds extensions. `next.config.ts` is otherwise empty (`{ /* config options here */ }`).
- **tsconfig** — `strict`, `noEmit`, `moduleResolution: "bundler"`, path alias `"@/*": ["./src/*"]`, `exclude: ["node_modules", "tests/e2e"]`, `target: ES2017`. Generated `next-env.d.ts` and `tsconfig.tsbuildinfo` sit at the repo root and are gitignored (see §4).
- **`npm run seed` is broken** — the script points at `scripts/seed.ts`, which (along with the whole `scripts/` directory) does not exist; seeding happens automatically at runtime via `store.ts:getQueryEngine()` → `seedInto` (see §6 and §19).
- **Secrets / in-memory mode** — see §5.3. With no `AULA_DATABASE_URL`/`AULA_REDIS_URL`, the app runs fully in-memory (the default for dev, demo, and tests). In-memory singletons that pin to `globalThis` survive HMR (store, domain, finance); webhook/notification registries are plain module arrays and **reset on reload**.
- **Minor known quirks:** `record-drawer.runAction` hardcodes the toast text "Deal {action} succeeded" even for non-deal entities; `convertQuoteToInvoice` does not enforce the quote being `accepted`; the `hasCloseDate` invariant is defined but unused; multi-currency totals are computed in document currency (not normalized to base); the `echo` webhook receiver does not verify the HMAC.

---

## 19. Demo Data

Seeded by `src/lib/data/seed.ts` (`async seedInto(repo)`). This is the **canonical seed entry point** — there is no `scripts/seed.ts` and the `npm run seed` script is currently broken (see §6). Seeding is invoked **at runtime, not via a CLI**: `getQueryEngine()` in `src/lib/data/store.ts` calls `seedInto(repo)` exactly once (`singletons.seedPromise ??= seedInto(...)`) on first data access, and `ensurePlatform()` then runs `reindexAll()`. All records use `mk(...)`, which stamps `version: 1` and `createdAt/updatedAt = T0 = "2026-01-15T09:00:00.000Z"`. Owners come from `DEMO_USERS` (`rep = u_rep`, `mgr = u_manager`).

**Demo tenant `t_acme` / `o_acme_eu`:**
- **account ×3** — Initech (technology, mgr), Umbrella Corp (healthcare, rep), Stark Industries (manufacturing, mgr).
- **contact ×2** — Bill Lumbergh @ Initech (mgr), Alice Wesker @ Umbrella (rep).
- **deal ×4** — "Initech — Printer Fleet" (qualified, $75k, rep), "Umbrella — Lab Systems" (negotiation, $540k, mgr), "Stark — Defense Platform" (won, $9.9M, mgr), "Initech — Expansion" (lead, $30k, rep).
- **task ×1** — "Follow up with Bill" (open, rep).
- **lead ×2** — Dana Scully / Wayne Enterprises (working, rep), Frank Castle / Cyberdyne (new, mgr).
- **currency ×4** — USD (1), EUR (1.08), GBP (1.27), TRY (0.03), owner mgr.
- **taxRate ×3** — Standard VAT 20% (EU), Reduced VAT 10% (EU), Zero 0% (Global).
- **product ×4** — Platform License (Annual) LIC-PLT $12k, Onboarding Package SVC-ONB $4.5k, Premium Support SVC-SUP $2k, Data Migration SVC-MIG €7.5k.
- **invoice ×3** — INV-1001 (Initech, partial, total 14,400 / paid 5,000 / balance 9,400), INV-1002 (Umbrella, sent, 60,000 / 0 / 60,000), INV-1003 (Stark, paid, 100,000 / 100,000 / 0), owner mgr.
- **invoiceLine ×3** — one per invoice.
- **payment ×2** — P-1001 ($5,000 on inv1), P-1002 ($100,000 on inv3).
- **recurringPlan ×1** — "Initech — Monthly Platform Fee" ($1,000/monthly, `nextRun: 2026-01-01`, intentionally in the past so the billing run generates one).
- **proposal ×3** — Initech Platform Rollout (sent $84k), Umbrella Lab Integration (accepted $220k), Stark Security Suite (draft $510k), owner rep.
- **estimation ×2** — EST-2001 (Initech, approved $42k), EST-2002 (Umbrella, sent $96k).
- **contract ×3** — Initech MSA (active $144k), Umbrella SLA (active $360k), Stark NDA + Build (draft $1.2M).
- **salesOrder ×3** — SO-3001 (Initech, confirmed $36k), SO-3002 (Stark, completed $100k), SO-3003 (Umbrella, pending $60k), owner rep.
- **project ×2** — "Initech CRM Migration" (active, high, $120k, 65%, mgr), "Umbrella Data Platform" (planning, medium, $280k, 15%, rep).
- **milestone ×4** — 3 on proj1 (Discovery & Audit done, Data Migration in_progress, Go-Live pending), 1 on proj2 (Requirements in_progress).
- **timesheet ×3** — Schema mapping (6h approved), ETL scripting (8h submitted), Kickoff workshop (4h, non-billable draft), owner rep.
- **campaign ×4** — Q1 Product Launch (email, running), Spring Webinar Series (social, scheduled), Renewal Reminders (sms, completed), Holiday WhatsApp Blast (whatsapp, draft).
- **ticket ×4** — Login fails after SSO (urgent/open), Export to CSV truncates (high/pending), dark mode request (low/open), Invoice PDF missing logo (medium/resolved), owner rep.
- **department ×3** — Sales (head Morgan Manager, hc 8), Engineering (head Dana Lee, hc 14), Support (head Sam Park, hc 5).
- **employee ×4** — Morgan Manager (Sales, active), Riley Rep (Sales, active), Dana Lee (Eng, active), Sam Park (Support, on_leave).

After seeding, number sequences are advanced (`numberSequence.bump(DEMO_TENANT, "INV", 1003)`, `bump(DEMO_TENANT, "P", 1002)`).

**Cross-tenant isolation record** (`t_globex` / `o_globex`, owner `u_globex_admin`):
- **account ×1** — "Globex Internal" (finance, https://globex.example, +1-555-9000, annualRevenue 50,000,000, employees 800). Because `scopeMatch` requires both `tenantId` and `orgId` to match, this record is unreachable from any `t_acme` context (list/get/search/aggregate).

---

## 20. Deployment / Production Notes

The app builds and runs as a standard Next.js 16 application (`npm run build` → `npm run start`). For production:

1. **Set secrets** — provide `AULA_JWT_SECRET` and `AULA_ENCRYPTION_KEY`. With `NODE_ENV=production` and `AULA_DATABASE_URL` set (outside `next build`), the app **throws** if these are missing.
2. **Provision backends** — set `AULA_DATABASE_URL` (PostgreSQL) and `AULA_REDIS_URL` (Redis). Then implement and wire the production adapters at the swap points:

| Concern | Swap point | Replace with |
|---|---|---|
| Persistence | `src/lib/data/store.ts` (`new InMemoryRepository()`) | `PostgresRepository implements Repository` |
| Cache | `src/lib/cache/cache.ts` | `RedisCache implements Cache` |
| Event bus | `src/lib/workflow/event-bus.ts` | Redis/broker bus implementing `EventBus` |
| Search | `src/lib/search/engine.ts` | OpenSearch / Typesense client |
| Auth | `src/lib/context/resolver.ts` via `enableJwtAuth(secret)` | JWT/OIDC (`jwtAuthenticator`) |

3. **Auth** — call `enableJwtAuth(AULA_JWT_SECRET)` to swap the dev cookie authenticator for real JWT/OIDC (tokens must carry `tenantId`+`orgId` claims). No other layer changes.
4. **Webhooks/notifications persistence** — these registries are in-memory module singletons; back them with a database for durability in production.
5. **Health** — `/api/v1/health` reports backend mode (`in-memory` vs `external`), metadata version, and a metrics snapshot.
6. **Security headers / CSRF** — provided by `src/proxy.ts` out of the box.

Because all enforcement lives above the repository in the query engine, swapping persistence does **not** change permission, validation, isolation, or lifecycle behavior.

---

## 21. Project History / Changelog

The build follows 14 numbered phases (each `src/lib/**` module carries a `Phase N —` header), followed by a UI overhaul, the CRM/Finance expansion, the automation layer, and the CRMS template alignment.

| Phase | Folder | Concern |
|---|---|---|
| 1 | `core/` | clock, ids, Result (bottom layer) |
| 2 | `metadata/` | metadata system: types, registry (versioned publish), resolver, schema, validation |
| 3 | `enforcement/` | errors, guards, structured error serialization |
| 4 | `context/` | multi-tenant RequestContext, resolver, isolation, dev identities |
| 5 | `data/` | QueryEngine + Repository + memory-repository + store + seed (unified data gateway) |
| 6 | `permissions/` | RBAC grants + ABAC + PII field projection |
| 7 | `domain/` | domain services, state-machine, invariants, audit |
| 8 | `workflow/` | event-bus, transactional outbox, idempotency, retry, workflows |
| 9 | `http/` + `app/api/v1/` | `runApi` wrapper, versioned REST API |
| 10 | `components/`, `app/[entity]/` | data-dense UI shell, generic entity screens |
| 11 | `observability/` | logger, metrics, tracing |
| 12 | `search/`, `cache/` | search engine/indexer/service; cache + invalidation |
| 13 | `security/` | auth, crypto, csrf, rate-limit, xss (JWT/OIDC swap point) |
| 14 | `config/` | feature-flags, governance gate, migrations, release trail |

Subsequent milestones:

- **UI overhaul** — theme system (`theme-provider`/`theme-toggle`), responsive shell (`shell-client`/`app-shell`/`sidebar`/`mobile-nav`), `⌘K` palette, data tables + pagination + toolbar, record drawer with inline edit + `If-Match`, dashboard charts + activity feed.
- **CRM/Finance (F0–F9)** — Leads + convert, pipeline Kanban, Calendar, global Activity, and full Billing/AR (`finance/`): Quotes/Invoices master-detail with server-computed totals, quote→invoice convert, Payments, recurring plans + billing-run, Finance dashboard, Reports, Admin `/settings`. Dedicated finance routes override the generic `[entity]` page; line entities are `system: true`.
- **Automation & integration** — `/automation` + `automation-admin`; HMAC-signed webhooks with a delivery log and echo receiver; in-memory notification inbox → topbar bell; scheduler (`billing-run` + `mark-overdue`) with `POST /api/v1/cron/tick`; all wired in `bootstrap.ts` `ensurePlatform()`.
- **CRMS template alignment (2026-06-02)** — re-skin to the Dreams Technologies "CRMS" template. Accent changed indigo → **red** (`--primary #e41f07` / dark `#fb4b2a`). `/login` rebuilt (email/password + social buttons, demo personas preserved) and rendered chrome-free via a `CHROMELESS` path list. **11 new metadata entities** added (proposal, estimation, contract, salesOrder, project, milestone, timesheet, campaign, ticket, department, employee), each auto-generating list/detail screens — which required extending `EntityGroup` in both `metadata/types.ts` and the Zod enum in `metadata/schema.ts`, plus `sidebar.tsx` GROUP_ORDER/LABEL and role grants. New dedicated pages: 7 dashboards, the auth set, error/utility pages, comms screens, `/pipeline`, the reports hub, and the settings hub. Build/lint/typecheck green.

> **Repository note:** Git history is a single "Initial commit from Create Next App"; the built application source has not been committed. There is no `ARCHITECTURE.md`, `AGENTS.md`, or `CLAUDE.md` in this repo. The original design specs live in `Frontend/modules/` and the master build prompt in `Frontend/Full-Prompt.txt` (the guiding principle is at `Full-Prompt.txt:73` and `modules/prompt-core/01_governing_principle.md`).

---

## 22. Acknowledgements & License

- **Design inspiration** — the visual design system is aligned with the **Dreams Technologies "CRMS"** CRM admin template (the red accent, sidebar grouping, and screen taxonomy). The implementation here is original and metadata-driven.
- **Built with** — Next.js, React, TypeScript, Zod, Tailwind CSS, lucide-react, Recharts, and Sonner.

**License:** No license file is present in this repository. The package is marked `private: true`. Treat the code as proprietary/unlicensed unless a license is added.
