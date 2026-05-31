// Kakeibo Engine web client.
// Vanilla ES modules, no build step and no external dependencies, so the UI
// works fully offline alongside the local API.

import { resolveLanguage, SUPPORTED_LANGUAGES, translate } from "./i18n.js";

const CATEGORY_KEYS = ["NEEDS", "WANTS", "CULTURE", "UNEXPECTED"];
const REFLECTION_KEYS = ["howMuchAvailable", "howMuchSaved", "howMuchSpent", "howToImprove"];
const LANGUAGE_STORAGE_KEY = "kakeibo-lang";

const els = {
  lang: document.getElementById("lang"),
  month: document.getElementById("month"),
  stats: document.getElementById("stats"),
  categories: document.getElementById("categories"),
  txForm: document.getElementById("tx-form"),
  txType: document.getElementById("tx-type"),
  txCategoryField: document.getElementById("tx-category-field"),
  txList: document.getElementById("tx-list"),
  planForm: document.getElementById("plan-form"),
  reflectionForm: document.getElementById("reflection-form"),
  toast: document.getElementById("toast"),
};

let currentLang = resolveLanguage(
  localStorage.getItem(LANGUAGE_STORAGE_KEY) ?? navigator.language ?? "en",
);

/** Translate a key in the active language. */
const t = (key, vars) => translate(currentLang, key, vars);
/** Localised label for a kakeibo category. */
const categoryLabel = (category) => t(`category.${category}`);

const currentMonth = () => els.month.value;

/** Thin fetch wrapper that surfaces API error envelopes as thrown errors. */
async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "content-type": "application/json" },
    ...options,
  });
  if (res.status === 204) return null;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.error?.message ?? `Request failed (${res.status})`);
  }
  return body;
}

function toast(message, isError = false) {
  els.toast.textContent = message;
  els.toast.classList.toggle("error", isError);
  els.toast.classList.add("show");
  setTimeout(() => els.toast.classList.remove("show"), 2200);
}

function stat(label, value, mood) {
  const moodClass = mood ? ` ${mood}` : "";
  return `<div class="stat"><div class="label">${label}</div><div class="value${moodClass}">${value}</div></div>`;
}

function renderSummary(summary) {
  const savingsMood = summary.savingsGoalMet ? "good" : "bad";
  const remainingMood = summary.remainingToSpend.minor < 0 ? "bad" : "good";
  els.stats.innerHTML = [
    stat(t("stat.availableToSpend"), summary.availableToSpend.formatted),
    stat(t("stat.remainingToSpend"), summary.remainingToSpend.formatted, remainingMood),
    stat(t("stat.income"), summary.totalIncome.formatted),
    stat(t("stat.expense"), summary.totalExpense.formatted),
    stat(t("stat.actualSavings"), summary.actualSavings.formatted, savingsMood),
    stat(
      t("stat.savingsGoal"),
      `${summary.savingsGoal.formatted} ${summary.savingsGoalMet ? "✓" : ""}`,
      savingsMood,
    ),
  ].join("");

  els.categories.innerHTML = summary.categories
    .map((c) => {
      const budget = c.budget.minor;
      const pct = budget > 0 ? Math.min(100, Math.round((c.spent.minor / budget) * 100)) : 0;
      const overClass = c.overBudget ? " over" : "";
      const budgetText =
        budget > 0
          ? t("msg.budgetUsage", { spent: c.spent.formatted, budget: c.budget.formatted, pct })
          : t("msg.noBudget", { spent: c.spent.formatted });
      return `
        <div class="cat-row">
          <div class="cat-head">
            <strong>${categoryLabel(c.category)}</strong>
            <span class="${c.overBudget ? "value bad" : "muted"}">${budgetText}</span>
          </div>
          <div class="bar${overClass}"><span style="width:${pct}%"></span></div>
        </div>`;
    })
    .join("");
}

function renderTransactions(list) {
  if (list.length === 0) {
    els.txList.innerHTML = `<tr><td colspan="6" class="muted">${t("msg.noTransactions")}</td></tr>`;
    return;
  }
  els.txList.innerHTML = list
    .map((tx) => {
      const date = tx.occurredAt.slice(0, 10);
      const category = tx.category ? categoryLabel(tx.category) : "—";
      const sign = tx.type === "INCOME" ? "+" : "−";
      const typeLabel = tx.type === "INCOME" ? t("type.income") : t("type.expense");
      return `
        <tr>
          <td>${date}</td>
          <td><span class="tag">${typeLabel}</span></td>
          <td>${category}</td>
          <td>${escapeHtml(tx.note)}</td>
          <td style="text-align:right">${sign}${tx.amount.formatted}</td>
          <td style="text-align:right"><button class="danger" data-id="${tx.id}">${t("button.delete")}</button></td>
        </tr>`;
    })
    .join("");
}

function renderPlan(plan) {
  els.planForm.querySelector("#plan-income").value = plan ? plan.plannedIncome.major : "";
  els.planForm.querySelector("#plan-savings").value = plan ? plan.savingsGoal.major : "";
  for (const key of CATEGORY_KEYS) {
    const input = els.planForm.querySelector(`#plan-${key}`);
    input.value = plan?.categoryBudgets?.[key] ? plan.categoryBudgets[key].major : "";
  }
}

function renderReflection(reflection) {
  els.reflectionForm.innerHTML = REFLECTION_KEYS.map((key) => {
    const value = reflection?.answers?.[key] ?? "";
    return `
      <div>
        <label>${t(`question.${key}`)}</label>
        <textarea data-key="${key}" rows="2">${escapeHtml(value)}</textarea>
      </div>`;
  }).join("");
}

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch],
  );
}

/** Applies translations to all static [data-i18n] elements in the document. */
function applyStaticTranslations() {
  document.documentElement.lang = currentLang;
  for (const el of document.querySelectorAll("[data-i18n]")) {
    el.textContent = t(el.dataset.i18n);
  }
  for (const el of document.querySelectorAll("[data-i18n-placeholder]")) {
    el.setAttribute("placeholder", t(el.dataset.i18nPlaceholder));
  }
}

async function refresh() {
  const month = currentMonth();
  try {
    const [summary, transactions, plan, reflection] = await Promise.all([
      api(`/api/summary?month=${month}`),
      api(`/api/transactions?month=${month}`),
      api(`/api/plans/${month}`).catch(() => null),
      api(`/api/reflections/${month}`).catch(() => null),
    ]);
    renderSummary(summary);
    renderTransactions(transactions);
    renderPlan(plan);
    renderReflection(reflection);
  } catch (err) {
    toast(err.message, true);
  }
}

function toggleCategoryField() {
  els.txCategoryField.style.display = els.txType.value === "EXPENSE" ? "" : "none";
}

function setLanguage(lang) {
  currentLang = SUPPORTED_LANGUAGES.includes(lang) ? lang : "en";
  localStorage.setItem(LANGUAGE_STORAGE_KEY, currentLang);
  els.lang.value = currentLang;
  applyStaticTranslations();
  refresh();
}

// --- Event wiring -----------------------------------------------------------

els.lang.addEventListener("change", () => setLanguage(els.lang.value));
els.month.addEventListener("change", refresh);
els.txType.addEventListener("change", toggleCategoryField);

els.txForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const type = els.txType.value;
  const payload = {
    type,
    amount: Number(document.getElementById("tx-amount").value),
    note: document.getElementById("tx-note").value || undefined,
    occurredAt: new Date(`${currentMonth()}-15T12:00:00Z`).toISOString(),
  };
  if (type === "EXPENSE") payload.category = document.getElementById("tx-category").value;
  try {
    await api("/api/transactions", { method: "POST", body: JSON.stringify(payload) });
    els.txForm.reset();
    toggleCategoryField();
    toast(t("toast.txAdded"));
    refresh();
  } catch (err) {
    toast(err.message, true);
  }
});

els.txList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-id]");
  if (!button) return;
  try {
    await api(`/api/transactions/${button.dataset.id}`, { method: "DELETE" });
    toast(t("toast.txDeleted"));
    refresh();
  } catch (err) {
    toast(err.message, true);
  }
});

els.planForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const categoryBudgets = {};
  for (const key of CATEGORY_KEYS) {
    const raw = els.planForm.querySelector(`#plan-${key}`).value;
    if (raw !== "") categoryBudgets[key] = Number(raw);
  }
  const body = {
    plannedIncome: Number(document.getElementById("plan-income").value),
    savingsGoal: Number(document.getElementById("plan-savings").value),
    categoryBudgets,
  };
  try {
    await api(`/api/plans/${currentMonth()}`, { method: "PUT", body: JSON.stringify(body) });
    toast(t("toast.planSaved"));
    refresh();
  } catch (err) {
    toast(err.message, true);
  }
});

els.reflectionForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const answers = {};
  for (const textarea of els.reflectionForm.querySelectorAll("textarea")) {
    answers[textarea.dataset.key] = textarea.value;
  }
  try {
    await api(`/api/reflections/${currentMonth()}`, {
      method: "PUT",
      body: JSON.stringify({ answers }),
    });
    toast(t("toast.reflectionSaved"));
  } catch (err) {
    toast(err.message, true);
  }
});

// --- Init -------------------------------------------------------------------

els.month.value = new Date().toISOString().slice(0, 7);
els.lang.value = currentLang;
applyStaticTranslations();
toggleCategoryField();
refresh();
