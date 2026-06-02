# CLAUDE.md

Guidance for working in this repository. Keep it accurate — update it when the
architecture or conventions change.

## What this is

**Kakeibo Engine** — a privacy-first, offline household budgeting app (Japanese
*kakeibo* method). **TypeScript + Bun**, **Clean Architecture**, no cloud, no
bank sync, **no paid API keys**. Data lives in a local SQLite file.

## Commands

- `bun test` — full test suite (`bun:test`).
- `bun run typecheck` — `tsc --noEmit`.
- `bun run check` — **Biome** lint + format check (no writes).
- `bun run lint` / `bun run format` — Biome lint only / auto-format (writes).
- `bun run dev` — server with hot reload (http://localhost:3000).
- `bun run start` — server.

**Tooling**: **Biome** is the linter + formatter (`biome.json`): 2-space, 100-col,
double quotes, semicolons, trailing commas; recommended lint rules (`noExplicitAny`
relaxed under `tests/**`). Run `bun run format` before committing.

CI (`.github/workflows/ci.yml`) is a single **"Type-check & test"** job that runs
**`biome ci`** + `bun run typecheck` + `bun test`. **All must be green** — they are
the merge gate.

## Architecture (dependencies point inward)

```
interface/      HTTP router, presenters, zod schemas, vanilla-JS web UI
  infrastructure/  SQLite + in-memory repos, system clock/uuid, Frankfurter adapter
    application/   use cases (one class each) + ports (interfaces)
      domain/      entities, value objects, pure services — ZERO dependencies
composition.ts   the only place concretes are wired (composition root)
```

- **domain/** (`src/domain/`): `Money`, `Currency`, `YearMonth`, `KakeiboCategory`,
  `Transaction`, `MonthlyPlan`, `Reflection`, `RecurringExpense`, `ExchangeRate`,
  and pure services `buildMonthlySummary` / `buildMonthlyForecast` / trend. No I/O,
  no framework, fully unit-tested. Invariants are enforced here and throw
  `DomainError` subclasses (`BusinessRuleError`, `InvalidValueError`,
  `CurrencyMismatchError`).
- **application/** (`src/application/`): one use-case class per file; depends only
  on domain + **ports** (`ports/`: repositories, `Clock`, `IdGenerator`,
  `ExchangeRateProvider`). Use-case errors are `ApplicationError`/`NotFoundError`.
- **infrastructure/** (`src/infrastructure/`): `bun:sqlite` repositories (+ in-memory
  twins for tests), `SystemClock`, `UuidIdGenerator`, `FrankfurterRateProvider`.
- **interface/** (`src/interface/`): `http/` (router, zod `schemas.ts`,
  `presenters.ts`, `json.ts` error→status mapping) and `web/` (the UI).
- Inject everything through `composition.ts`; tests construct use cases directly
  with in-memory adapters / fakes (`tests/support/`).

## Money & multi-currency invariants (read before touching money code)

- **Money is integer minor units** (`Money.ofMinor` / `ofMajor`; JPY has 0 minor
  units, USD/EUR/etc. 2). Never use floats for stored amounts. Rounding happens
  once, at conversion.
- Each `Transaction` / `RecurringExpense` keeps its **original amount + currency**
  **and** a **`baseAmount`** in the app base currency (`DEFAULT_CURRENCY`),
  captured at booking time. `MonthlyPlan` keeps base equivalents of its fields.
- **All aggregation (summary/forecast/trend) sums `baseAmount` in the base
  currency.** Mixed-currency months total correctly; historical totals don't move
  when rates change later.
- A **foreign-currency entry REQUIRES an explicit rate** — never default to 1.
  Missing rate → `ApplicationError` → HTTP 400. (Applies to transactions, plans,
  recurring, and CSV import, which carries a `base_amount` column.)
- Auto rates come from **Frankfurter** (`FrankfurterRateProvider`, key-less,
  `api.frankfurter.app`). It never throws — on any failure it returns `null` and
  the UI falls back to manual entry. The host must be on the network allowlist.
- Persistence: base columns are **nullable** with idempotent `ALTER` migrations
  (`addColumnIfMissing`); legacy rows read back as identity.

## Web UI (`src/interface/web/`)

- **Vanilla ES modules — no framework, no build step.** Don't introduce React etc.
- `app.js` does manual DOM updates; pure helpers live in `i18n.js`,
  `currency-format.js`, `a11y-labels.js` (these are unit-tested; `app.js` wiring is
  not).
- **i18n**: every user-facing string is a key in `i18n.js` with **en + ja**.
  A parity test enforces both languages define the same keys — add to both.
  Detail-bearing API errors pass through the server's English message; only
  generic transport codes (`VALIDATION_ERROR`/`NOT_FOUND`/`INTERNAL_ERROR`) are
  localised.
- **Accessibility**: a static-page **axe** audit runs in the suite; keep new
  controls labelled, use `aria-live` for dynamic text, no axe regressions.
- "Entry currency" (per amount field) ≠ "Display currency" (top toggle, converts
  totals for display only).

## Testing & workflow conventions

- **TDD.** Write the failing test first and **commit tests separately from
  implementation** (`test:` commit, then `feat:`/`fix:`). Logic is covered at the
  domain/application/e2e levels; UI/CSS changes are verified by review + the axe /
  i18n-parity tests staying green.
- Comments, code, and README are **in English**. Conventional-commit-style messages.
- Run **`bun run format`** (Biome) before committing; CI fails on lint/format drift.
- **Secrets**: no paid keys. Any free key would go in `.env` (git-ignored); none
  are needed today.

### Branching & PRs

- **One feature/fix per branch**, branched from and PR'd into `main`. Don't stack
  PRs (a merged branch's deletion can cascade-close dependents).
- **Never force-push.** Resolve conflicts by **merging `main` into the branch**
  (not rebasing), then a normal push.
- **Do not merge a PR without explicit per-request approval** — creating a PR is
  fine; merging needs the user's say-so for that PR.
- When asked, self-review the diff before declaring done.
