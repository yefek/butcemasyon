// Core types & seed data for the budget app (ported from PDF source).
export type TxType = "income" | "expense";

export type RecurringFreq = "weekly" | "monthly";

export interface Transaction {
  id: number;
  type: TxType;
  category: string;
  icon: string;
  subcategory: string;
  amount: number;
  note: string;
  date: string; // YYYY-MM-DD
  createdAt?: string;              // ISO timestamp used to order entries within the same day
  recurring?: RecurringFreq;        // if set, this tx is part of a recurring series
  recurringGroupId?: number;        // shared id across instances
  movementType?: import("./finance").MovementType;
  sourceAccountId?: string;
  destinationAccountId?: string;
}

export const todayLabelTR = (d: Date = new Date()) =>
  `${d.getDate()} ${MONTH_TR[d.getMonth()]} ${d.getFullYear()}`;

export function expandRecurring(tx: Omit<Transaction, "id">, baseId: number): Omit<Transaction, "id">[] {
  if (!tx.recurring) return [tx];
  const out: Omit<Transaction, "id">[] = [];
  const start = new Date(tx.date);
  const end = new Date();
  const stepDays = tx.recurring === "weekly" ? 7 : 0;
  const cur = new Date(start);
  let safety = 0;
  while (cur <= end && safety < 260) {
    out.push({
      ...tx,
      date: cur.toISOString().split("T")[0],
      recurringGroupId: baseId,
    });
    if (tx.recurring === "weekly") cur.setDate(cur.getDate() + stepDays);
    else cur.setMonth(cur.getMonth() + 1);
    safety++;
  }
  return out;
}

export const MONTH_TR = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

export const THEMES = [
  { id: "midnight", name: "Gece",      hue: "from-violet-500 to-cyan-400" },
  { id: "violet",   name: "Mor",       hue: "from-purple-500 to-fuchsia-400" },
  { id: "emerald",  name: "Zümrüt",    hue: "from-emerald-500 to-teal-400" },
  { id: "sunset",   name: "Gün Batımı",hue: "from-orange-500 to-rose-400" },
  { id: "rose",     name: "Gül",       hue: "from-rose-500 to-purple-400" },
  { id: "ocean",    name: "Okyanus",   hue: "from-sky-500 to-cyan-400" },
] as const;
export type ThemeId = typeof THEMES[number]["id"];

// Distinct palette for chart slices — perceptually spaced
export const CHART_PALETTE = [
  "hsl(248 70% 56%)", "hsl(350 80% 58%)", "hsl(162 72% 42%)", "hsl(35 95% 55%)",
  "hsl(280 80% 60%)", "hsl(195 85% 50%)", "hsl(15 85% 58%)", "hsl(180 70% 42%)",
  "hsl(258 65% 50%)", "hsl(330 75% 55%)", "hsl(140 65% 42%)", "hsl(45 95% 55%)",
  "hsl(220 80% 55%)", "hsl(300 70% 55%)", "hsl(160 70% 38%)", "hsl(25 90% 55%)",
];

const today = () => new Date().toISOString().split("T")[0];
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
};

export const SEED_TRANSACTIONS: Transaction[] = [
  { id: 1,  type: "income",  category: "Maaş",        icon: "💼", subcategory: "",         amount: 42000, note: "Aylık maaş",        date: daysAgo(2) },
  { id: 2,  type: "income",  category: "Freelance",   icon: "🎨", subcategory: "",         amount: 8500,  note: "Logo tasarımı",     date: daysAgo(5) },
  { id: 3,  type: "expense", category: "Konut",       icon: "🏠", subcategory: "Kira",     amount: 14500, note: "",                  date: daysAgo(1) },
  { id: 4,  type: "expense", category: "Market",      icon: "🛒", subcategory: "",         amount: 1850,  note: "Migros",            date: daysAgo(0) },
  { id: 5,  type: "expense", category: "Abonelikler", icon: "📱", subcategory: "Netflix",  amount: 149,   note: "",                  date: daysAgo(3) },
  { id: 6,  type: "expense", category: "Abonelikler", icon: "📱", subcategory: "Spotify",  amount: 79,    note: "",                  date: daysAgo(3) },
  { id: 7,  type: "expense", category: "Ulaşım",      icon: "🚌", subcategory: "",         amount: 620,   note: "İstanbulkart",      date: daysAgo(4) },
  { id: 8,  type: "expense", category: "Faturalar",   icon: "⚡", subcategory: "Elektrik", amount: 480,   note: "",                  date: daysAgo(7) },
  { id: 9,  type: "expense", category: "Faturalar",   icon: "💧", subcategory: "Su",       amount: 220,   note: "",                  date: daysAgo(7) },
  { id: 10, type: "expense", category: "Yeme-İçme",   icon: "🍔", subcategory: "Restoran", amount: 980,   note: "Akşam yemeği",      date: daysAgo(0) },
  { id: 11, type: "expense", category: "Yeme-İçme",   icon: "☕", subcategory: "Kahve",    amount: 95,    note: "",                  date: daysAgo(1) },
  { id: 12, type: "expense", category: "Eğlence",     icon: "🎬", subcategory: "Sinema",   amount: 320,   note: "",                  date: daysAgo(6) },
  { id: 13, type: "expense", category: "Sağlık",      icon: "💊", subcategory: "",         amount: 540,   note: "Eczane",            date: daysAgo(8) },
  { id: 14, type: "expense", category: "Market",      icon: "🛒", subcategory: "",         amount: 1240,  note: "",                  date: daysAgo(9) },
];

export const fmtTRY = (n: number) =>
  new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(n);

export const formatDateTR = (date: string) => {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day || month < 1 || month > 12) return date;
  return `${day} ${MONTH_TR[month - 1]} ${year}`;
};

export const capitalizeFirstLetterTR = (value: string) => {
  const firstCharacterIndex = value.search(/\S/);
  if (firstCharacterIndex === -1) return value;

  return value.slice(0, firstCharacterIndex)
    + value[firstCharacterIndex].toLocaleUpperCase("tr-TR")
    + value.slice(firstCharacterIndex + 1);
};

const transactionTimestamp = (transaction: Transaction) => {
  if (transaction.createdAt) {
    const timestamp = Date.parse(transaction.createdAt);
    if (Number.isFinite(timestamp)) return timestamp;
  }

  return transaction.id >= 1_000_000_000_000 ? transaction.id : 0;
};

export const compareTransactionsDesc = (a: Transaction, b: Transaction) => {
  const dateOrder = b.date.localeCompare(a.date);
  if (dateOrder !== 0) return dateOrder;

  const timeOrder = transactionTimestamp(b) - transactionTimestamp(a);
  return timeOrder !== 0 ? timeOrder : b.id - a.id;
};

export const groupTransactionsByDate = (transactions: Transaction[]) => {
  const groups = new Map<string, Transaction[]>();
  transactions.forEach(transaction => {
    const group = groups.get(transaction.date) ?? [];
    group.push(transaction);
    groups.set(transaction.date, group);
  });

  return Array.from(groups.entries())
    .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
    .map(([date, items]) => [date, items.sort(compareTransactionsDesc)] as const);
};

export const fmtTRYSigned = (n: number) =>
  (n >= 0 ? "+" : "") + fmtTRY(n);

export const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, n) + "…" : s);

export const dateLabel = (date: string) => {
  const t = today();
  const y = daysAgo(1);
  if (date === t) return "Bugün";
  if (date === y) return "Dün";
  const [yr, m, d] = date.split("-");
  return `${parseInt(d)} ${MONTH_TR[parseInt(m) - 1]}`;
};

export const monthLabel = (key: string) => {
  const [y, m] = key.split("-");
  return `${MONTH_TR[parseInt(m) - 1]} ${y}`;
};
