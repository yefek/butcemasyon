import { describe, expect, it } from "vitest";
import { capitalizeFirstLetterTR, compareTransactionsDesc, formatDateTR, groupTransactionsByDate, type Transaction } from "@/budget/data";

const transaction = (overrides: Partial<Transaction>): Transaction => ({
  id: 1,
  type: "expense",
  category: "Market",
  icon: "",
  subcategory: "",
  amount: 100,
  note: "",
  date: "2026-07-19",
  ...overrides,
});

describe("formatDateTR", () => {
  it("formats an ISO date in Turkish without a timezone conversion", () => {
    expect(formatDateTR("2026-07-19")).toBe("19 Temmuz 2026");
  });
});

describe("capitalizeFirstLetterTR", () => {
  it("capitalizes the first non-space character with Turkish casing", () => {
    expect(capitalizeFirstLetterTR("istanbul kirası")).toBe("İstanbul kirası");
    expect(capitalizeFirstLetterTR("  market alışverişi")).toBe("  Market alışverişi");
  });
});

describe("compareTransactionsDesc", () => {
  it("orders different days by date first", () => {
    const olderDay = transaction({ id: 2, date: "2026-07-18", createdAt: "2026-07-20T12:00:00.000Z" });
    const newerDay = transaction({ id: 1, date: "2026-07-19", createdAt: "2026-07-18T12:00:00.000Z" });

    expect([olderDay, newerDay].sort(compareTransactionsDesc)).toEqual([newerDay, olderDay]);
  });

  it("orders entries on the same day by creation time", () => {
    const earlier = transaction({ id: 1, createdAt: "2026-07-19T10:00:00.000Z" });
    const later = transaction({ id: 2, createdAt: "2026-07-19T12:00:00.000Z" });

    expect([earlier, later].sort(compareTransactionsDesc)).toEqual([later, earlier]);
  });

  it("falls back to a millisecond id for older local entries", () => {
    const earlier = transaction({ id: 1_721_380_000_000 });
    const later = transaction({ id: 1_721_381_000_000 });

    expect([earlier, later].sort(compareTransactionsDesc)).toEqual([later, earlier]);
  });
});

describe("groupTransactionsByDate", () => {
  it("orders date groups newest first and entries within a day by time", () => {
    const olderDay = transaction({ id: 3, date: "2026-07-16", createdAt: "2026-07-16T18:00:00.000Z" });
    const earlierSameDay = transaction({ id: 1, date: "2026-07-19", createdAt: "2026-07-19T09:00:00.000Z" });
    const laterSameDay = transaction({ id: 2, date: "2026-07-19", createdAt: "2026-07-19T14:00:00.000Z" });

    const groups = groupTransactionsByDate([olderDay, earlierSameDay, laterSameDay]);

    expect(groups.map(([date]) => date)).toEqual(["2026-07-19", "2026-07-16"]);
    expect(groups[0][1].map(item => item.id)).toEqual([2, 1]);
  });
});
