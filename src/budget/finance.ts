import type { Transaction, TxType } from "./data";

export type AccountType = "cash" | "investment" | "credit_card";
export type InvestmentType = "stock" | "gold" | "fund" | "crypto" | "other";
export type MovementType =
  | "income"
  | "expense"
  | "transfer"
  | "investment_contribution"
  | "investment_withdrawal"
  | "card_payment"
  | "balance_adjustment";

export interface FinancialAccount {
  id: string;
  clientId: number;
  type: AccountType;
  name: string;
  openingBalance: number;
  creditLimit?: number;
  statementDay?: number;
  dueDay?: number;
  investmentType?: InvestmentType;
  isDefault?: boolean;
  archivedAt?: string;
}

export interface FinancialSummary {
  balances: Record<string, number>;
  availableCash: number;
  investmentTotal: number;
  cardDebt: number;
  cardLimit: number;
  cardUsagePct: number;
  netWorth: number;
}

export const INVESTMENT_TYPE_LABELS: Record<InvestmentType, string> = {
  stock: "Hisse senedi",
  gold: "Altın",
  fund: "Fon",
  crypto: "Kripto",
  other: "Diğer",
};

export function movementTypeOf(transaction: Transaction): MovementType {
  return transaction.movementType ?? transaction.type;
}

export function reportTypeOf(transaction: Transaction): TxType | null {
  const movementType = movementTypeOf(transaction);
  return movementType === "income" || movementType === "expense" ? movementType : null;
}

export function isReportableTransaction(transaction: Transaction) {
  return reportTypeOf(transaction) !== null;
}

export function computeFinancialSummary(
  accounts: FinancialAccount[],
  transactions: Transaction[],
): FinancialSummary {
  const activeAccounts = accounts.filter(account => !account.archivedAt);
  const balances = Object.fromEntries(
    accounts.map(account => [account.id, Number(account.openingBalance) || 0]),
  );
  const defaultCash = activeAccounts.find(account => account.type === "cash" && account.isDefault)
    ?? activeAccounts.find(account => account.type === "cash");

  const add = (accountId: string | undefined, amount: number) => {
    if (!accountId || balances[accountId] === undefined) return;
    balances[accountId] += amount;
  };

  transactions.forEach(transaction => {
    const movementType = movementTypeOf(transaction);
    const source = transaction.sourceAccountId;
    const destination = transaction.destinationAccountId;

    if (movementType === "income") {
      add(destination ?? defaultCash?.id, transaction.amount);
      return;
    }

    if (movementType === "expense") {
      const sourceAccount = accounts.find(account => account.id === source);
      if (sourceAccount?.type === "credit_card") add(source, transaction.amount);
      else add(source ?? defaultCash?.id, -transaction.amount);
      return;
    }

    if (movementType === "investment_contribution" || movementType === "transfer") {
      add(source ?? defaultCash?.id, -transaction.amount);
      add(destination, transaction.amount);
      return;
    }

    if (movementType === "investment_withdrawal") {
      add(source, -transaction.amount);
      add(destination ?? defaultCash?.id, transaction.amount);
      return;
    }

    if (movementType === "card_payment") {
      add(source ?? defaultCash?.id, -transaction.amount);
      add(destination, -transaction.amount);
      return;
    }

    if (movementType === "balance_adjustment") {
      add(destination ?? source, transaction.amount);
    }
  });

  const availableCash = activeAccounts
    .filter(account => account.type === "cash")
    .reduce((sum, account) => sum + (balances[account.id] ?? 0), 0);
  const investmentTotal = activeAccounts
    .filter(account => account.type === "investment")
    .reduce((sum, account) => sum + (balances[account.id] ?? 0), 0);
  const cardDebt = activeAccounts
    .filter(account => account.type === "credit_card")
    .reduce((sum, account) => sum + Math.max(0, balances[account.id] ?? 0), 0);
  const cardLimit = activeAccounts
    .filter(account => account.type === "credit_card")
    .reduce((sum, account) => sum + Math.max(0, account.creditLimit ?? 0), 0);

  return {
    balances,
    availableCash,
    investmentTotal,
    cardDebt,
    cardLimit,
    cardUsagePct: cardLimit > 0 ? (cardDebt / cardLimit) * 100 : 0,
    netWorth: availableCash + investmentTotal - cardDebt,
  };
}

export function movementLabel(transaction: Transaction) {
  switch (movementTypeOf(transaction)) {
    case "investment_contribution": return "Yatırıma aktarım";
    case "investment_withdrawal": return "Yatırımdan çekim";
    case "card_payment": return "Kart ödemesi";
    case "transfer": return "Hesaplar arası aktarım";
    case "balance_adjustment": return "Bakiye düzeltmesi";
    default: return transaction.subcategory || transaction.category;
  }
}

export function nextMonthlyDate(day: number, from: Date = new Date()) {
  const normalizedDay = Math.max(1, Math.min(31, Math.trunc(day)));
  const candidate = new Date(from.getFullYear(), from.getMonth(), normalizedDay);
  if (candidate.getMonth() !== from.getMonth()) {
    candidate.setDate(0);
  }
  candidate.setHours(0, 0, 0, 0);

  const today = new Date(from);
  today.setHours(0, 0, 0, 0);
  if (candidate >= today) return candidate;

  const next = new Date(from.getFullYear(), from.getMonth() + 1, normalizedDay);
  if (next.getDate() !== normalizedDay) next.setDate(0);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function cardDueDate(statementDate: Date) {
  const dueDate = new Date(statementDate);
  dueDate.setDate(dueDate.getDate() + 10);
  if (dueDate.getDay() === 6) dueDate.setDate(dueDate.getDate() + 2);
  else if (dueDate.getDay() === 0) dueDate.setDate(dueDate.getDate() + 1);
  dueDate.setHours(0, 0, 0, 0);
  return dueDate;
}

export function toISODate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function monthlyDayLabel(day: number) {
  const tensSuffix: Record<number, string> = { 10: "'u", 20: "'si", 30: "'u" };
  const lastDigitSuffix: Record<number, string> = {
    1: "'i", 2: "'si", 3: "'ü", 4: "'ü", 5: "'i",
    6: "'sı", 7: "'si", 8: "'i", 9: "'u",
  };
  const suffix = tensSuffix[day] ?? lastDigitSuffix[day % 10] ?? "'i";
  return `Her ayın ${day}${suffix}`;
}
