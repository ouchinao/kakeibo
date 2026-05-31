import { beforeEach, describe, expect, test } from "bun:test";
import { KakeiboCategory } from "../../src/domain/category.ts";
import { GetMonthlyPlan } from "../../src/application/use-cases/get-monthly-plan.ts";
import { SaveMonthlyPlan } from "../../src/application/use-cases/save-monthly-plan.ts";
import { GetReflection } from "../../src/application/use-cases/get-reflection.ts";
import { SaveReflection } from "../../src/application/use-cases/save-reflection.ts";
import {
  InMemoryMonthlyPlanRepository,
  InMemoryReflectionRepository,
} from "../../src/infrastructure/persistence/in-memory-repositories.ts";
import { SequentialIdGenerator } from "../support/fakes.ts";

describe("monthly plan use cases", () => {
  let repo: InMemoryMonthlyPlanRepository;
  let save: SaveMonthlyPlan;
  let get: GetMonthlyPlan;

  beforeEach(() => {
    repo = new InMemoryMonthlyPlanRepository();
    const ids = new SequentialIdGenerator();
    save = new SaveMonthlyPlan(repo, ids);
    get = new GetMonthlyPlan(repo);
  });

  test("creates a plan with category budgets", async () => {
    const plan = await save.execute({
      month: "2026-05",
      currency: "JPY",
      plannedIncomeMinor: 300000,
      savingsGoalMinor: 60000,
      categoryBudgetsMinor: { [KakeiboCategory.NEEDS]: 150000 },
    });

    expect(plan.availableToSpend().amount).toBe(240000);
    expect(plan.budgetFor(KakeiboCategory.NEEDS).amount).toBe(150000);
  });

  test("upsert keeps the same id when updating a month", async () => {
    const first = await save.execute({
      month: "2026-05",
      currency: "JPY",
      plannedIncomeMinor: 300000,
      savingsGoalMinor: 60000,
    });
    const second = await save.execute({
      month: "2026-05",
      currency: "JPY",
      plannedIncomeMinor: 320000,
      savingsGoalMinor: 80000,
    });

    expect(second.id).toBe(first.id);
    const stored = await get.execute("2026-05");
    expect(stored?.savingsGoal.amount).toBe(80000);
  });

  test("returns null for a month without a plan", async () => {
    expect(await get.execute("2030-01")).toBeNull();
  });
});

describe("reflection use cases", () => {
  let repo: InMemoryReflectionRepository;
  let save: SaveReflection;
  let get: GetReflection;

  beforeEach(() => {
    repo = new InMemoryReflectionRepository();
    const ids = new SequentialIdGenerator();
    save = new SaveReflection(repo, ids);
    get = new GetReflection(repo);
  });

  test("saves only known question keys", async () => {
    const reflection = await save.execute({
      month: "2026-05",
      answers: {
        howToImprove: "Cook at home more",
        // @ts-expect-error unknown keys must be rejected at the type level too
        bogus: "ignored",
      },
    });
    expect(reflection.answerFor("howToImprove")).toBe("Cook at home more");
    expect(reflection.answers.size).toBe(1);
  });

  test("upsert preserves identity across updates", async () => {
    const first = await save.execute({
      month: "2026-05",
      answers: { howMuchSaved: "¥60,000" },
    });
    const second = await save.execute({
      month: "2026-05",
      answers: { howMuchSaved: "¥80,000" },
    });
    expect(second.id).toBe(first.id);
    expect((await get.execute("2026-05"))?.answerFor("howMuchSaved")).toBe("¥80,000");
  });
});
