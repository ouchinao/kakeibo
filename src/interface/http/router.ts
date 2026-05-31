import { type KakeiboCategory } from "../../domain/category.ts";
import { Money } from "../../domain/money.ts";
import { ApplicationError } from "../../application/errors.ts";
import { type CreateRecurringExpense } from "../../application/use-cases/create-recurring-expense.ts";
import { type DeleteRecurringExpense } from "../../application/use-cases/delete-recurring-expense.ts";
import { type DeleteTransaction } from "../../application/use-cases/delete-transaction.ts";
import { type GetForecast } from "../../application/use-cases/get-forecast.ts";
import { type GetMonthlyPlan } from "../../application/use-cases/get-monthly-plan.ts";
import { type GetMonthlySummary } from "../../application/use-cases/get-monthly-summary.ts";
import { type GetReflection } from "../../application/use-cases/get-reflection.ts";
import { type GetTrend } from "../../application/use-cases/get-trend.ts";
import { type ImportTransactions } from "../../application/use-cases/import-transactions.ts";
import { type ListRecurringExpenses } from "../../application/use-cases/list-recurring-expenses.ts";
import { type ListTransactions } from "../../application/use-cases/list-transactions.ts";
import { type PostRecurringExpenses } from "../../application/use-cases/post-recurring-expenses.ts";
import { type RecordTransaction } from "../../application/use-cases/record-transaction.ts";
import { type SaveMonthlyPlan } from "../../application/use-cases/save-monthly-plan.ts";
import { type SaveReflection } from "../../application/use-cases/save-reflection.ts";
import { csvToImportRecords, transactionsToCsv } from "./transaction-csv.ts";
import { json, toErrorResponse } from "./json.ts";
import {
  forecastToDto,
  planToDto,
  recurringExpenseToDto,
  reflectionToDto,
  summaryToDto,
  transactionToDto,
  trendToDto,
} from "./presenters.ts";
import {
  createRecurringExpenseSchema,
  recordTransactionSchema,
  saveMonthlyPlanSchema,
  saveReflectionSchema,
} from "./schemas.ts";

/** Everything the HTTP router needs, injected from the composition root. */
export interface RouterDeps {
  recordTransaction: RecordTransaction;
  listTransactions: ListTransactions;
  deleteTransaction: DeleteTransaction;
  saveMonthlyPlan: SaveMonthlyPlan;
  getMonthlyPlan: GetMonthlyPlan;
  getMonthlySummary: GetMonthlySummary;
  saveReflection: SaveReflection;
  getReflection: GetReflection;
  createRecurringExpense: CreateRecurringExpense;
  listRecurringExpenses: ListRecurringExpenses;
  deleteRecurringExpense: DeleteRecurringExpense;
  postRecurringExpenses: PostRecurringExpenses;
  getForecast: GetForecast;
  getTrend: GetTrend;
  importTransactions: ImportTransactions;
  defaultCurrency: string;
  /** Optional static-asset handler for the web UI (returns null to fall through). */
  serveStatic?: (pathname: string) => Promise<Response | null>;
}

type Handler = (req: Request, ctx: RouteContext) => Promise<Response>;
interface RouteContext {
  url: URL;
  params: Record<string, string>;
}

/**
 * Creates the application's HTTP request handler.
 *
 * The returned function is a plain `(Request) => Promise<Response>`, so it can
 * be driven directly in tests (no socket needed) and handed to `Bun.serve`.
 */
export function createRouter(deps: RouterDeps): (req: Request) => Promise<Response> {
  const routes = buildRoutes(deps);

  return async function fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    try {
      for (const route of routes) {
        if (route.method !== req.method) continue;
        const params = matchPath(route.pattern, url.pathname);
        if (params === null) continue;
        return await route.handler(req, { url, params });
      }

      // Fall through to static assets (web UI) for unmatched GETs.
      if (req.method === "GET" && deps.serveStatic) {
        const asset = await deps.serveStatic(url.pathname);
        if (asset) return asset;
      }
      return json({ error: { message: "Not found", code: "NOT_FOUND" } }, 404);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

interface Route {
  method: string;
  pattern: string;
  handler: Handler;
}

function buildRoutes(deps: RouterDeps): Route[] {
  const requireMonth = (ctx: RouteContext): string => {
    const month = ctx.params.month ?? ctx.url.searchParams.get("month");
    if (!month) throw new RouteError("Missing required 'month' parameter");
    return month;
  };

  return [
    {
      method: "GET",
      pattern: "/api/health",
      handler: async () => json({ status: "ok" }),
    },
    {
      method: "POST",
      pattern: "/api/transactions",
      handler: async (req) => {
        const input = recordTransactionSchema.parse(await req.json());
        const currency = input.currency ?? deps.defaultCurrency;
        const tx = await deps.recordTransaction.execute({
          type: input.type,
          amountMinor: Money.ofMajor(input.amount, currency).amount,
          currency,
          category: input.category as KakeiboCategory | undefined,
          occurredAt: input.occurredAt ? new Date(input.occurredAt) : undefined,
          note: input.note,
        });
        return json(transactionToDto(tx), 201);
      },
    },
    {
      method: "GET",
      pattern: "/api/transactions",
      handler: async (_req, ctx) => {
        const txs = await deps.listTransactions.execute(requireMonth(ctx));
        return json(txs.map(transactionToDto));
      },
    },
    {
      method: "GET",
      pattern: "/api/transactions/export",
      handler: async (_req, ctx) => {
        const month = requireMonth(ctx);
        const txs = await deps.listTransactions.execute(month);
        return new Response(transactionsToCsv(txs), {
          headers: {
            "content-type": "text/csv; charset=utf-8",
            "content-disposition": `attachment; filename="kakeibo-${month}.csv"`,
          },
        });
      },
    },
    {
      method: "POST",
      pattern: "/api/transactions/import",
      handler: async (req) => {
        const csv = await req.text();
        const records = csvToImportRecords(csv, deps.defaultCurrency);
        const result = await deps.importTransactions.execute(records);
        return json({ imported: result.imported }, 201);
      },
    },
    {
      method: "DELETE",
      pattern: "/api/transactions/:id",
      handler: async (_req, ctx) => {
        await deps.deleteTransaction.execute(ctx.params.id as string);
        return new Response(null, { status: 204 });
      },
    },
    {
      method: "GET",
      pattern: "/api/summary",
      handler: async (_req, ctx) => {
        const summary = await deps.getMonthlySummary.execute(requireMonth(ctx));
        return json(summaryToDto(summary));
      },
    },
    {
      method: "GET",
      pattern: "/api/trend",
      handler: async (_req, ctx) => {
        const monthsParam = ctx.url.searchParams.get("months");
        const months = monthsParam === null ? 6 : Number(monthsParam);
        const points = await deps.getTrend.execute(requireMonth(ctx), months);
        return json(trendToDto(points));
      },
    },
    {
      method: "GET",
      pattern: "/api/plans/:month",
      handler: async (_req, ctx) => {
        const plan = await deps.getMonthlyPlan.execute(ctx.params.month as string);
        return plan === null
          ? json({ error: { message: "No plan for month", code: "NOT_FOUND" } }, 404)
          : json(planToDto(plan));
      },
    },
    {
      method: "PUT",
      pattern: "/api/plans/:month",
      handler: async (req, ctx) => {
        const input = saveMonthlyPlanSchema.parse(await req.json());
        const currency = input.currency ?? deps.defaultCurrency;
        const toMinor = (major: number) => Money.ofMajor(major, currency).amount;
        const categoryBudgetsMinor: Partial<Record<KakeiboCategory, number>> = {};
        for (const [category, major] of Object.entries(input.categoryBudgets ?? {})) {
          categoryBudgetsMinor[category as KakeiboCategory] = toMinor(major);
        }
        const plan = await deps.saveMonthlyPlan.execute({
          month: ctx.params.month as string,
          currency,
          plannedIncomeMinor: toMinor(input.plannedIncome),
          savingsGoalMinor: toMinor(input.savingsGoal),
          categoryBudgetsMinor,
        });
        return json(planToDto(plan));
      },
    },
    {
      method: "GET",
      pattern: "/api/forecast",
      handler: async (_req, ctx) => {
        const forecast = await deps.getForecast.execute(requireMonth(ctx));
        return json(forecastToDto(forecast));
      },
    },
    {
      method: "POST",
      pattern: "/api/recurring",
      handler: async (req) => {
        const input = createRecurringExpenseSchema.parse(await req.json());
        const currency = input.currency ?? deps.defaultCurrency;
        const recurring = await deps.createRecurringExpense.execute({
          name: input.name,
          amountMinor: Money.ofMajor(input.amount, currency).amount,
          currency,
          category: input.category as KakeiboCategory,
          dayOfMonth: input.dayOfMonth,
          active: input.active,
        });
        return json(recurringExpenseToDto(recurring), 201);
      },
    },
    {
      method: "GET",
      pattern: "/api/recurring",
      handler: async () => {
        const list = await deps.listRecurringExpenses.execute();
        return json(list.map(recurringExpenseToDto));
      },
    },
    {
      method: "POST",
      pattern: "/api/recurring/post",
      handler: async (_req, ctx) => {
        const result = await deps.postRecurringExpenses.execute(requireMonth(ctx));
        return json({ posted: result.posted });
      },
    },
    {
      method: "DELETE",
      pattern: "/api/recurring/:id",
      handler: async (_req, ctx) => {
        await deps.deleteRecurringExpense.execute(ctx.params.id as string);
        return new Response(null, { status: 204 });
      },
    },
    {
      method: "GET",
      pattern: "/api/reflections/:month",
      handler: async (_req, ctx) => {
        const reflection = await deps.getReflection.execute(ctx.params.month as string);
        return reflection === null
          ? json({ error: { message: "No reflection for month", code: "NOT_FOUND" } }, 404)
          : json(reflectionToDto(reflection));
      },
    },
    {
      method: "PUT",
      pattern: "/api/reflections/:month",
      handler: async (req, ctx) => {
        const input = saveReflectionSchema.parse(await req.json());
        const reflection = await deps.saveReflection.execute({
          month: ctx.params.month as string,
          answers: input.answers,
        });
        return json(reflectionToDto(reflection));
      },
    },
  ];
}

/** Raised by route handlers for malformed routing input (mapped to 400). */
class RouteError extends ApplicationError {}

/**
 * Matches a path against a "/a/:b" pattern.
 *
 * @returns the captured params, or null when the path does not match.
 */
function matchPath(pattern: string, pathname: string): Record<string, string> | null {
  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = pathname.split("/").filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i += 1) {
    const patternPart = patternParts[i] as string;
    const pathPart = pathParts[i] as string;
    if (patternPart.startsWith(":")) {
      params[patternPart.slice(1)] = decodeURIComponent(pathPart);
    } else if (patternPart !== pathPart) {
      return null;
    }
  }
  return params;
}
