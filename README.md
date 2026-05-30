# 💰 Kakeibo Engine

A privacy-first, **offline** household budgeting engine based on the
century-old Japanese **kakeibo** (家計簿) method, built with **TypeScript +
Bun** following **Clean Architecture**.

No bank sync, no cloud, no API keys, no tracking. Your financial data never
leaves your machine — it lives in a local SQLite file that Bun reads and
writes directly.

---

## Why this app?

Market research for 2026 points to a clear, validated direction:

- People who **manually** track expenses save **20–35% more** than those who
  rely on passive bank-sync apps — the deliberate act of categorising spending
  is what changes behaviour.
- Pure pen-and-paper kakeibo is **too slow** for most people today.
- The sweet spot is a **hybrid**: kakeibo's mindfulness (intentional
  categories, an explicit savings goal, and monthly reflection) combined with
  an app's speed and instant "money left to spend" feedback.
- There is strong, growing demand for **privacy-first / offline** money tools
  with no bank connections.

Kakeibo Engine is exactly that hybrid.

### The kakeibo method in one minute

At the start of each month you answer one question: _"How much income do I
have, how much do I want to save, and therefore how much can I spend?"_ Every
expense is then placed into one of four pillars:

| Pillar          | Examples                                       |
| --------------- | ---------------------------------------------- |
| **Needs**       | Rent, groceries, utilities, transport, medical |
| **Wants**       | Dining out, shopping, subscriptions            |
| **Culture**     | Books, museums, courses, hobbies               |
| **Unexpected**  | Repairs, gifts, emergencies                    |

At month-end you answer four reflection questions to learn and adjust. The app
models all of this as first-class domain concepts.

---

## Features

- **Monthly plan** — set planned income, a savings goal, and optional
  per-category budgets. The app derives your kakeibo spending envelope
  (`income − savings goal`).
- **Transactions** — record income and categorised expenses in exact,
  rounding-safe integer money.
- **Live summary** — real-time "money left to spend", income vs. expense,
  actual savings vs. goal, and per-category budget progress (with over-budget
  warnings).
- **Month-end reflection** — capture answers to the four kakeibo questions.
- **Multi-currency** — JPY, USD, EUR out of the box, with currency-correct
  precision (e.g. JPY has no minor unit).
- **Web UI** — a dependency-free, offline single-page interface.
- **HTTP API** — a small JSON API you can script against.

---

## Quick start

Requires [Bun](https://bun.sh) (developed against Bun 1.3).

```bash
bun install
cp .env.example .env      # optional; sensible defaults are built in
bun run dev               # starts on http://localhost:3000
```

Open <http://localhost:3000> for the web UI.

### Scripts

| Command                 | Description                                  |
| ----------------------- | -------------------------------------------- |
| `bun run dev`           | Start the server with hot reload             |
| `bun run start`         | Start the server                             |
| `bun test`              | Run the full test suite                      |
| `bun run test:coverage` | Run tests with a coverage report             |
| `bun run typecheck`     | Type-check the project with `tsc --noEmit`   |

### Configuration

All configuration is via environment variables (see `.env.example`). The real
`.env` file is git-ignored.

| Variable           | Default                  | Description                                   |
| ------------------ | ------------------------ | --------------------------------------------- |
| `PORT`             | `3000`                   | HTTP port for the API + web UI                |
| `DATABASE_PATH`    | `./data/kakeibo.sqlite`  | SQLite file path, or `:memory:` for ephemeral |
| `DEFAULT_CURRENCY` | `JPY`                    | Currency used when a request omits one        |

---

## HTTP API

Amounts in requests are in human-friendly **major units** (e.g. `1200` for
¥1,200, `12.34` for $12.34). Responses return money as a structured object with
`minor`, `major`, `currency`, and `formatted` fields.

| Method   | Path                              | Description                        |
| -------- | --------------------------------- | --------------------------------- |
| `GET`    | `/api/health`                     | Liveness check                    |
| `POST`   | `/api/transactions`               | Record an income/expense          |
| `GET`    | `/api/transactions?month=YYYY-MM` | List a month's transactions       |
| `DELETE` | `/api/transactions/:id`           | Delete a transaction              |
| `GET`    | `/api/plans/:month`               | Get the plan for a month          |
| `PUT`    | `/api/plans/:month`               | Create/update the plan for a month |
| `GET`    | `/api/summary?month=YYYY-MM`      | Get the monthly summary read model |
| `GET`    | `/api/reflections/:month`         | Get a month's reflection          |
| `PUT`    | `/api/reflections/:month`         | Create/update a month's reflection |

### Examples

```bash
# Plan May 2026: ¥300,000 income, save ¥60,000, ¥150,000 for needs.
curl -X PUT http://localhost:3000/api/plans/2026-05 \
  -H 'content-type: application/json' \
  -d '{"plannedIncome":300000,"savingsGoal":60000,"categoryBudgets":{"NEEDS":150000}}'

# Record a ¥1,500 groceries expense.
curl -X POST http://localhost:3000/api/transactions \
  -H 'content-type: application/json' \
  -d '{"type":"EXPENSE","amount":1500,"category":"NEEDS","note":"Groceries"}'

# See where you stand.
curl "http://localhost:3000/api/summary?month=2026-05"
```

---

## Architecture

The project follows Clean Architecture: dependencies point **inwards**, and the
domain depends on nothing.

```
┌─────────────────────────────────────────────────────────────┐
│ interface/      HTTP router, presenters, validation, web UI  │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ infrastructure/  SQLite + in-memory repos, clock, ids │   │
│   │   ┌─────────────────────────────────────────────┐    │   │
│   │   │ application/  use cases + ports (interfaces)  │    │   │
│   │   │   ┌─────────────────────────────────────┐    │    │   │
│   │   │   │ domain/  entities, value objects,    │    │    │   │
│   │   │   │          domain services (pure)      │    │    │   │
│   │   │   └─────────────────────────────────────┘    │    │   │
│   │   └─────────────────────────────────────────────┘    │   │
│   └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
            composition.ts wires everything together
```

- **`domain/`** — `Money`, `YearMonth`, `KakeiboCategory`, the `Transaction`,
  `MonthlyPlan`, and `Reflection` entities, and the pure `buildMonthlySummary`
  service. Enforces all business invariants. Zero dependencies.
- **`application/`** — use cases (one class each) and **ports**: repository,
  `Clock`, and `IdGenerator` interfaces. Depends only on the domain.
- **`infrastructure/`** — adapters that implement the ports: `bun:sqlite` and
  in-memory repositories, a system clock, and a UUID generator.
- **`interface/`** — the delivery layer: a framework-light HTTP router, zod
  request validation, presenters (domain → JSON DTOs), and the web UI.
- **`composition.ts`** — the single composition root where concrete
  implementations are chosen and injected.

### Design highlights

- **Exact money.** `Money` stores integer minor units, so there are no
  floating-point rounding bugs. Currency precision is respected (JPY: 0
  decimals, USD/EUR: 2).
- **Dependency inversion.** Use cases depend on port interfaces, never on
  SQLite or Bun — so the same use cases run against in-memory fakes in tests.
- **Errors as a boundary concern.** Domain/application errors are mapped to
  HTTP status codes in exactly one place (`interface/http/json.ts`).

### Project layout

```
src/
  domain/                 # entities, value objects, domain services
  application/
    ports/                # repository / clock / id-generator interfaces
    use-cases/            # one use case per file
  infrastructure/
    persistence/          # SQLite + in-memory repositories, schema
    system/               # system clock, UUID generator
  interface/
    http/                 # router, presenters, schemas, error mapping
    web/                  # offline single-page web UI
  composition.ts          # composition root
  main.ts                 # process entry point (Bun.serve)
tests/
  domain/                 # unit tests
  application/            # use-case integration tests
  infrastructure/         # SQLite adapter integration tests
  interface/              # static handler tests
  e2e/                    # full HTTP-stack tests
  support/                # test fakes (FixedClock, SequentialIdGenerator)
```

---

## Testing strategy

This project uses the **Testing Trophy** — the right shape for an
I/O-and-integration-heavy application like this one. Most value comes from
integration tests that exercise real wiring (use cases against repositories,
the HTTP stack against the real router and SQLite), with a solid base of fast
unit tests for the pure, invariant-rich domain, and a thin layer of end-to-end
tests.

| Layer            | What it covers                                       |
| ---------------- | ---------------------------------------------------- |
| **Unit**         | Domain value objects & entities, the summary service |
| **Integration**  | Use cases (via in-memory repos), SQLite adapters     |
| **E2E**          | The full HTTP stack via `Request`/`Response`         |

```bash
bun test                 # 85 tests, runs in well under a second
bun run test:coverage    # ~98% line coverage
```

Because the domain and use cases are pure and depend only on injected ports,
the HTTP handler is a plain `(Request) => Promise<Response>` function that can
be tested without opening a socket, and use cases can be tested without a
database.

---

## Privacy & security

- **Offline by design.** No external network calls, no third-party APIs, no API
  keys. The app only ever talks to a local SQLite file.
- The static file server is restricted to its web root and guards against path
  traversal.
- All request input is validated at the boundary with zod before it reaches a
  use case.

---

## License

MIT — see [LICENSE](./LICENSE).
