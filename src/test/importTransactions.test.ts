import { describe, expect, it } from "vitest";
import { parseTransactionImport } from "@/budget/importTransactions";
import { getNextRecurringDate, groupRecurringTransactions } from "@/budget/recurring";
import type { Transaction } from "@/budget/data";

describe("parseTransactionImport", () => {
  it("reads Lovable/Supabase style exports", () => {
    const result = parseTransactionImport({
      transactions: [{
        client_id: 42,
        type: "expense",
        category: "market",
        subcategory: "alışveriş",
        amount: "1.249,50 ₺",
        date: "2026-06-12",
        note: "haftalık alışveriş",
        recurring: "weekly",
        created_at: "2026-06-12T18:30:00.000Z",
      }],
    }, 1000);

    expect(result.skipped).toBe(0);
    expect(result.username).toBeUndefined();
    expect(result.transactions[0]).toMatchObject({
      id: 42,
      type: "expense",
      category: "Market",
      subcategory: "Alışveriş",
      amount: 1249.5,
      recurring: "weekly",
    });
  });

  it("preserves the owner username for account matching", () => {
    const result = parseTransactionImport({
      username: "sevinc",
      transactions: [{
        client_id: 7,
        type: "income",
        category: "Maaş",
        amount: 100,
        date: "2026-07-01",
      }],
    });

    expect(result.username).toBe("sevinc");
  });

  it("skips invalid rows", () => {
    const result = parseTransactionImport([{ type: "expense", amount: 10 }]);
    expect(result.transactions).toHaveLength(0);
    expect(result.skipped).toBe(1);
  });
});

describe("recurring series", () => {
  it("groups equivalent occurrences and finds the next date", () => {
    const transactions: Transaction[] = [
      { id: 1, type: "expense", category: "Abonelik", subcategory: "Müzik", amount: 60, note: "", icon: "", date: "2026-06-20", recurring: "monthly" },
      { id: 2, type: "expense", category: "Abonelik", subcategory: "Müzik", amount: 60, note: "", icon: "", date: "2026-07-20", recurring: "monthly" },
    ];
    const series = groupRecurringTransactions(transactions);
    expect(series).toHaveLength(1);
    expect(series[0].ids).toEqual([2, 1]);
    expect(series[0].nextDate).toBe("2026-08-20");
  });

  it("keeps month-end dates valid", () => {
    expect(getNextRecurringDate("2026-01-31", "monthly")).toBe("2026-02-28");
  });
});
