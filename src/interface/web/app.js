// Kakeibo Engine web client.
// Vanilla ES modules, no build step and no external dependencies, so the UI
// works fully offline alongside the local API.

const CATEGORY_LABELS = {
  NEEDS: "Needs",
  WANTS: "Wants",
  CULTURE: "Culture",
  UNEXPECTED: "Unexpected",
};

const REFLECTION_KEYS = ["howMuchAvailable", "howMuchSaved", "howMuchSpent", "howToImprove"];

const els = {
  month: document.getElementById("month"),
  stats: document.getElementById("stats"),
  categories: document.getElementById("categories"),
  txForm: document.getElementById("tx-form"),
  txType: document.getElementById("tx-type"),
  txCategoryField: document.getElementById("tx-category-field"),
  txList: document.getElementById("tx-list"),
  planForm: document.getElementById("plan-form"),
  reflectionForm: document.getElementById("reflection-form"),
  forecast: document.getElementById("forecast"),
  recurringForm: document.getElementById("recurring-form"),
  recurringList: document.getElementById("recurring-list"),
  postRecurringBtn: document.getElementById("post-recurring-btn"),
  trend: document.getElementById("trend"),
  trendRange: document.getElementById("trend-range"),
  exportBtn: document.getElementById("export-btn"),
  importBtn: document.getElementById("import-btn"),
  importInput: document.getElementById("import-input"),
  toast: document.getElementById("toast"),
};

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
    stat("Available to spend", summary.availableToSpend.formatted),
    stat("Remaining to spend", summary.remainingToSpend.formatted, remainingMood),
    stat("Income", summary.totalIncome.formatted),
    stat("Expense", summary.totalExpense.formatted),
    stat("Actual savings", summary.actualSavings.formatted, savingsMood),
    stat(
      "Savings goal",
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
          ? `${c.spent.formatted} / ${c.budget.formatted} (${pct}%)`
          : `${c.spent.formatted} spent · no budget set`;
      return `
        <div class="cat-row">
          <div class="cat-head">
            <strong>${CATEGORY_LABELS[c.category]}</strong>
            <span class="${c.overBudget ? "value bad" : "muted"}">${budgetText}</span>
          </div>
          <div class="bar${overClass}"><span style="width:${pct}%"></span></div>
        </div>`;
    })
    .join("");
}

function renderTransactions(list) {
  if (list.length === 0) {
    els.txList.innerHTML = `<tr><td colspan="6" class="muted">No transactions yet.</td></tr>`;
    return;
  }
  els.txList.innerHTML = list
    .map((tx) => {
      const date = tx.occurredAt.slice(0, 10);
      const category = tx.category ? CATEGORY_LABELS[tx.category] : "—";
      const sign = tx.type === "INCOME" ? "+" : "−";
      return `
        <tr>
          <td>${date}</td>
          <td><span class="tag">${tx.type === "INCOME" ? "Income" : "Expense"}</span></td>
          <td>${category}</td>
          <td>${escapeHtml(tx.note)}</td>
          <td style="text-align:right">${sign}${tx.amount.formatted}</td>
          <td style="text-align:right"><button class="danger" data-id="${tx.id}">Delete</button></td>
        </tr>`;
    })
    .join("");
}

function renderPlan(plan) {
  els.planForm.querySelector("#plan-income").value = plan ? plan.plannedIncome.major : "";
  els.planForm.querySelector("#plan-savings").value = plan ? plan.savingsGoal.major : "";
  for (const key of Object.keys(CATEGORY_LABELS)) {
    const input = els.planForm.querySelector(`#plan-${key}`);
    input.value = plan?.categoryBudgets?.[key] ? plan.categoryBudgets[key].major : "";
  }
}

function renderForecast(forecast) {
  const netMood = forecast.onTrack ? "good" : "bad";
  els.forecast.innerHTML = `
    <div class="grid" style="grid-template-columns: 1fr 1fr; gap: 12px">
      ${stat("Projected net", `${forecast.projectedNet.formatted} ${forecast.onTrack ? "✓" : ""}`, netMood)}
      ${stat("Projected expense", forecast.projectedExpense.formatted)}
      ${stat("Recurring remaining", forecast.recurringRemaining.formatted)}
      ${stat("Expected income", forecast.expectedIncome.formatted)}
    </div>
    <p class="muted" style="margin: 12px 0 0; font-size: 0.85rem">
      Projection = expected income − (actual expense + recurring not yet posted).
    </p>`;
}

function renderRecurring(list) {
  if (list.length === 0) {
    els.recurringList.innerHTML = `<p class="muted">No recurring expenses yet.</p>`;
    return;
  }
  els.recurringList.innerHTML = list
    .map(
      (r) => `
        <div class="cat-row" style="display:flex; justify-content:space-between; align-items:center; gap:8px">
          <div>
            <strong>${escapeHtml(r.name)}</strong>
            <span class="muted"> · ${CATEGORY_LABELS[r.category]} · day ${r.dayOfMonth}</span>
          </div>
          <div style="display:flex; align-items:center; gap:10px">
            <span>${r.amount.formatted}</span>
            <button class="danger" data-recurring-id="${r.id}">Delete</button>
          </div>
        </div>`,
    )
    .join("");
}

function renderTrend(points) {
  if (points.length === 0) {
    els.trend.innerHTML = `<p class="muted">No data.</p>`;
    return;
  }

  const W = Math.max(points.length * 64, 200);
  const H = 180;
  const padTop = 10;
  const padBottom = 24;
  const chartH = H - padTop - padBottom;

  const values = points.flatMap((p) => [p.totalIncome.minor, p.totalExpense.minor, p.actualSavings.minor]);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const y = (v) => padTop + ((max - v) / range) * chartH;
  const zeroY = y(0);

  const groupW = W / points.length;
  const barW = Math.min(14, groupW / 4);

  const bar = (cx, value, color, label) => {
    const top = y(Math.max(value, 0));
    const bottom = y(Math.min(value, 0));
    const h = Math.max(bottom - top, 1);
    return `<rect x="${cx - barW / 2}" y="${top}" width="${barW}" height="${h}" rx="2" fill="${color}"><title>${label}</title></rect>`;
  };

  const bars = points
    .map((p, i) => {
      const center = i * groupW + groupW / 2;
      const month = p.month.slice(2); // YY-MM
      return `
        ${bar(center - barW - 1, p.totalIncome.minor, "var(--accent)", `Income ${p.totalIncome.formatted}`)}
        ${bar(center, p.totalExpense.minor, "var(--warn)", `Expense ${p.totalExpense.formatted}`)}
        ${bar(center + barW + 1, p.actualSavings.minor, "#60a5fa", `Savings ${p.actualSavings.formatted}`)}
        <text x="${center}" y="${H - 8}" text-anchor="middle" font-size="10" fill="var(--muted)">${month}</text>`;
    })
    .join("");

  els.trend.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Monthly trend chart">
      <line x1="0" y1="${zeroY}" x2="${W}" y2="${zeroY}" stroke="var(--line)" stroke-width="1" />
      ${bars}
    </svg>`;
}

function renderReflection(reflection, questions) {
  els.reflectionForm.innerHTML = REFLECTION_KEYS.map((key) => {
    const value = reflection?.answers?.[key] ?? "";
    return `
      <div>
        <label>${questions[key]}</label>
        <textarea data-key="${key}" rows="2">${escapeHtml(value)}</textarea>
      </div>`;
  }).join("");
}

const DEFAULT_QUESTIONS = {
  howMuchAvailable: "How much money did you have available?",
  howMuchSaved: "How much money did you manage to save?",
  howMuchSpent: "How much money did you actually spend?",
  howToImprove: "How can you improve next month?",
};

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch],
  );
}

async function refresh() {
  const month = currentMonth();
  try {
    const [summary, transactions, plan, reflection, forecast, recurring, trend] =
      await Promise.all([
        api(`/api/summary?month=${month}`),
        api(`/api/transactions?month=${month}`),
        api(`/api/plans/${month}`).catch(() => null),
        api(`/api/reflections/${month}`).catch(() => null),
        api(`/api/forecast?month=${month}`),
        api(`/api/recurring`),
        api(`/api/trend?month=${month}&months=${els.trendRange.value}`),
      ]);
    renderSummary(summary);
    renderTransactions(transactions);
    renderPlan(plan);
    renderReflection(reflection, reflection?.questions ?? DEFAULT_QUESTIONS);
    renderForecast(forecast);
    renderRecurring(recurring);
    renderTrend(trend);
  } catch (err) {
    toast(err.message, true);
  }
}

function toggleCategoryField() {
  els.txCategoryField.style.display = els.txType.value === "EXPENSE" ? "" : "none";
}

// --- Event wiring -----------------------------------------------------------

els.month.addEventListener("change", refresh);
els.trendRange.addEventListener("change", refresh);
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
    toast("Transaction added");
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
    toast("Transaction deleted");
    refresh();
  } catch (err) {
    toast(err.message, true);
  }
});

els.planForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const categoryBudgets = {};
  for (const key of Object.keys(CATEGORY_LABELS)) {
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
    toast("Plan saved");
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
    toast("Reflection saved");
  } catch (err) {
    toast(err.message, true);
  }
});

els.recurringForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = {
    name: document.getElementById("rec-name").value,
    amount: Number(document.getElementById("rec-amount").value),
    category: document.getElementById("rec-category").value,
    dayOfMonth: Number(document.getElementById("rec-day").value),
  };
  try {
    await api("/api/recurring", { method: "POST", body: JSON.stringify(payload) });
    els.recurringForm.reset();
    document.getElementById("rec-day").value = "1";
    toast("Recurring expense added");
    refresh();
  } catch (err) {
    toast(err.message, true);
  }
});

els.recurringList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-recurring-id]");
  if (!button) return;
  try {
    await api(`/api/recurring/${button.dataset.recurringId}`, { method: "DELETE" });
    toast("Recurring expense deleted");
    refresh();
  } catch (err) {
    toast(err.message, true);
  }
});

els.postRecurringBtn.addEventListener("click", async () => {
  try {
    const result = await api(`/api/recurring/post?month=${currentMonth()}`, { method: "POST" });
    toast(`Posted ${result.posted} recurring expense(s)`);
    refresh();
  } catch (err) {
    toast(err.message, true);
  }
});

els.exportBtn.addEventListener("click", () => {
  // Let the browser download the CSV via the export endpoint.
  window.location.href = `/api/transactions/export?month=${currentMonth()}`;
});

els.importBtn.addEventListener("click", () => els.importInput.click());

els.importInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const csv = await file.text();
    const res = await fetch("/api/transactions/import", {
      method: "POST",
      headers: { "content-type": "text/csv" },
      body: csv,
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(body?.error?.message ?? `Import failed (${res.status})`);
    toast(`Imported ${body.imported} transaction(s)`);
    refresh();
  } catch (err) {
    toast(err.message, true);
  } finally {
    els.importInput.value = "";
  }
});

// --- Init -------------------------------------------------------------------

els.month.value = new Date().toISOString().slice(0, 7);
toggleCategoryField();
refresh();
