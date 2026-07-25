import { describe, expect, it } from "vitest";
import {
  cardDueDate,
  computeFinancialSummary,
  monthlyDayLabel,
  reportTypeOf,
  type FinancialAccount,
} from "../budget/finance";
import type { Transaction } from "../budget/data";

const accounts: FinancialAccount[] = [
  { id: "cash", clientId: 1, type: "cash", name: "Nakit", openingBalance: 10_000, isDefault: true },
  { id: "investment", clientId: 2, type: "investment", name: "Fon", openingBalance: 0, investmentType: "fund" },
  { id: "card", clientId: 3, type: "credit_card", name: "Kartım", openingBalance: 0, creditLimit: 20_000 },
];

const tx = (patch: Partial<Transaction>): Transaction => ({
  id: 1,
  type: "expense",
  category: "Test",
  icon: "",
  subcategory: "",
  amount: 1_000,
  note: "",
  date: "2026-07-25",
  ...patch,
});

describe("financial account balances", () => {
  it("moves money to an investment without creating an expense", () => {
    const transaction = tx({
      movementType: "investment_contribution",
      sourceAccountId: "cash",
      destinationAccountId: "investment",
      amount: 2_000,
    });
    const result = computeFinancialSummary(accounts, [transaction]);

    expect(result.availableCash).toBe(8_000);
    expect(result.investmentTotal).toBe(2_000);
    expect(result.netWorth).toBe(10_000);
    expect(reportTypeOf(transaction)).toBeNull();
  });

  it("counts a card purchase once and keeps cash unchanged", () => {
    const transaction = tx({ sourceAccountId: "card", amount: 1_500 });
    const result = computeFinancialSummary(accounts, [transaction]);

    expect(result.availableCash).toBe(10_000);
    expect(result.cardDebt).toBe(1_500);
    expect(result.netWorth).toBe(8_500);
    expect(reportTypeOf(transaction)).toBe("expense");
  });

  it("pays card debt without creating a second expense", () => {
    const purchase = tx({ id: 1, sourceAccountId: "card", amount: 1_500 });
    const payment = tx({
      id: 2,
      movementType: "card_payment",
      sourceAccountId: "cash",
      destinationAccountId: "card",
      amount: 1_000,
    });
    const result = computeFinancialSummary(accounts, [purchase, payment]);

    expect(result.availableCash).toBe(9_000);
    expect(result.cardDebt).toBe(500);
    expect(result.netWorth).toBe(8_500);
    expect(reportTypeOf(payment)).toBeNull();
  });
});

describe("credit card dates", () => {
  it("moves a Saturday due date to Monday", () => {
    const dueDate = cardDueDate(new Date(2026, 6, 22));
    expect(dueDate.getFullYear()).toBe(2026);
    expect(dueDate.getMonth()).toBe(7);
    expect(dueDate.getDate()).toBe(3);
    expect(dueDate.getDay()).toBe(1);
  });

  it("formats monthly statement days", () => {
    expect(monthlyDayLabel(22)).toBe("Her ayın 22'si");
    expect(monthlyDayLabel(15)).toBe("Her ayın 15'i");
  });
});
