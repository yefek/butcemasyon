import { describe, expect, it } from "vitest";
import { getSavingsStatus } from "@/budget/stats";

describe("getSavingsStatus", () => {
  it("shows a positive balance as savings", () => {
    expect(getSavingsStatus(25)).toEqual({
      isOverspent: false,
      label: "Tasarruf",
      value: "%25",
    });
  });

  it("shows a negative balance as overspending without a negative percentage", () => {
    expect(getSavingsStatus(-105)).toEqual({
      isOverspent: true,
      label: "Aşım",
      value: "%105",
    });
  });
});
