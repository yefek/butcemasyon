import { compareTransactionsDesc, type RecurringFreq, type Transaction } from "./data";

export interface RecurringSeries {
  key: string;
  ids: number[];
  transaction: Transaction;
  frequency: RecurringFreq;
  nextDate: string;
}

const dateParts = (date: string) => {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

export function getNextRecurringDate(date: string, frequency: RecurringFreq) {
  const next = dateParts(date);
  if (frequency === "weekly") {
    next.setUTCDate(next.getUTCDate() + 7);
    return isoDate(next);
  }

  const day = next.getUTCDate();
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(day, lastDay));
  return isoDate(next);
}

function fallbackSeriesKey(transaction: Transaction) {
  const date = dateParts(transaction.date);
  const cadenceAnchor = transaction.recurring === "weekly"
    ? `weekday:${date.getUTCDay()}`
    : `day:${date.getUTCDate()}`;
  return [
    transaction.type,
    transaction.category.trim().toLocaleLowerCase("tr-TR"),
    transaction.subcategory.trim().toLocaleLowerCase("tr-TR"),
    transaction.note.trim().toLocaleLowerCase("tr-TR"),
    transaction.amount,
    transaction.recurring,
    cadenceAnchor,
  ].join("|");
}

export function groupRecurringTransactions(transactions: Transaction[]): RecurringSeries[] {
  const groups = new Map<string, Transaction[]>();
  transactions.filter(transaction => transaction.recurring).forEach(transaction => {
    const key = transaction.recurringGroupId
      ? `group:${transaction.recurringGroupId}`
      : fallbackSeriesKey(transaction);
    groups.set(key, [...(groups.get(key) ?? []), transaction]);
  });

  return Array.from(groups.entries()).map(([key, items]) => {
    const sorted = items.sort(compareTransactionsDesc);
    const transaction = sorted[0];
    const frequency = transaction.recurring as RecurringFreq;
    return {
      key,
      ids: sorted.map(item => item.id),
      transaction,
      frequency,
      nextDate: getNextRecurringDate(transaction.date, frequency),
    };
  }).sort((a, b) => a.nextDate.localeCompare(b.nextDate));
}

export const recurringFrequencyLabel = (frequency: RecurringFreq) =>
  frequency === "weekly" ? "Her hafta" : "Her ay";
