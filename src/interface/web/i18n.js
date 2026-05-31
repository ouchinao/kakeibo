// Internationalisation dictionary and lookup for the web UI.
//
// Pure module (no DOM access) so it can be unit-tested directly. The DOM
// application layer lives in app.js. Supported languages: English and Japanese.

export const SUPPORTED_LANGUAGES = ["en", "ja"];
export const DEFAULT_LANGUAGE = "en";

export const translations = {
  en: {
    "app.subtitle": "— mindful monthly budgeting",
    "label.month": "Month",
    "label.language": "Language",

    "heading.categorySpending": "Spending by category",
    "heading.addTransaction": "Add transaction",
    "heading.monthlyPlan": "Monthly plan",
    "heading.transactions": "Transactions",
    "heading.reflection": "Month-end reflection",

    "label.type": "Type",
    "label.amount": "Amount",
    "label.category": "Category",
    "label.note": "Note",
    "label.plannedIncome": "Planned income",
    "label.savingsGoal": "Savings goal",
    "label.needsBudget": "Needs budget",
    "label.wantsBudget": "Wants budget",
    "label.cultureBudget": "Culture budget",
    "label.unexpectedBudget": "Unexpected budget",
    "placeholder.note": "optional",

    "button.add": "Add",
    "button.savePlan": "Save plan",
    "button.saveReflection": "Save reflection",
    "button.delete": "Delete",

    "table.date": "Date",
    "table.type": "Type",
    "table.category": "Category",
    "table.note": "Note",
    "table.amount": "Amount",

    "type.income": "Income",
    "type.expense": "Expense",

    "category.NEEDS": "Needs",
    "category.WANTS": "Wants",
    "category.CULTURE": "Culture",
    "category.UNEXPECTED": "Unexpected",

    "stat.availableToSpend": "Available to spend",
    "stat.remainingToSpend": "Remaining to spend",
    "stat.income": "Income",
    "stat.expense": "Expense",
    "stat.actualSavings": "Actual savings",
    "stat.savingsGoal": "Savings goal",

    "question.howMuchAvailable": "How much money did you have available?",
    "question.howMuchSaved": "How much money did you manage to save?",
    "question.howMuchSpent": "How much money did you actually spend?",
    "question.howToImprove": "How can you improve next month?",

    "msg.noTransactions": "No transactions yet.",
    "msg.noBudget": "{spent} spent · no budget set",
    "msg.budgetUsage": "{spent} / {budget} ({pct}%)",

    "toast.txAdded": "Transaction added",
    "toast.txDeleted": "Transaction deleted",
    "toast.planSaved": "Plan saved",
    "toast.reflectionSaved": "Reflection saved",
  },
  ja: {
    "app.subtitle": "— 心がけて続ける月次家計簿",
    "label.month": "月",
    "label.language": "言語",

    "heading.categorySpending": "カテゴリ別の支出",
    "heading.addTransaction": "取引を追加",
    "heading.monthlyPlan": "月次プラン",
    "heading.transactions": "取引一覧",
    "heading.reflection": "月末の振り返り",

    "label.type": "種別",
    "label.amount": "金額",
    "label.category": "カテゴリ",
    "label.note": "メモ",
    "label.plannedIncome": "予定収入",
    "label.savingsGoal": "貯蓄目標",
    "label.needsBudget": "必要費の予算",
    "label.wantsBudget": "欲しい物の予算",
    "label.cultureBudget": "教養・娯楽の予算",
    "label.unexpectedBudget": "予備費の予算",
    "placeholder.note": "任意",

    "button.add": "追加",
    "button.savePlan": "プランを保存",
    "button.saveReflection": "振り返りを保存",
    "button.delete": "削除",

    "table.date": "日付",
    "table.type": "種別",
    "table.category": "カテゴリ",
    "table.note": "メモ",
    "table.amount": "金額",

    "type.income": "収入",
    "type.expense": "支出",

    "category.NEEDS": "必要費",
    "category.WANTS": "欲しい物",
    "category.CULTURE": "教養・娯楽",
    "category.UNEXPECTED": "予備費",

    "stat.availableToSpend": "使える金額",
    "stat.remainingToSpend": "残り使える金額",
    "stat.income": "収入",
    "stat.expense": "支出",
    "stat.actualSavings": "実際の貯蓄",
    "stat.savingsGoal": "貯蓄目標",

    "question.howMuchAvailable": "今月使えるお金はいくらありましたか？",
    "question.howMuchSaved": "いくら貯金できましたか？",
    "question.howMuchSpent": "実際にいくら使いましたか？",
    "question.howToImprove": "来月はどう改善できますか？",

    "msg.noTransactions": "取引はまだありません。",
    "msg.noBudget": "支出 {spent} ・予算未設定",
    "msg.budgetUsage": "{spent} / {budget}（{pct}%）",

    "toast.txAdded": "取引を追加しました",
    "toast.txDeleted": "取引を削除しました",
    "toast.planSaved": "プランを保存しました",
    "toast.reflectionSaved": "振り返りを保存しました",
  },
};

/**
 * Translates a key for a language, interpolating {placeholders} from `vars`.
 * Falls back to English, then to the raw key, so a missing translation never
 * produces an empty string.
 */
export function translate(lang, key, vars = {}) {
  const table = translations[lang] ?? translations[DEFAULT_LANGUAGE];
  const template = table[key] ?? translations[DEFAULT_LANGUAGE][key] ?? key;
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match,
  );
}

/** Normalises an arbitrary locale string to a supported language code. */
export function resolveLanguage(input) {
  if (typeof input !== "string") return DEFAULT_LANGUAGE;
  const lower = input.toLowerCase();
  return SUPPORTED_LANGUAGES.find((lang) => lower.startsWith(lang)) ?? DEFAULT_LANGUAGE;
}
