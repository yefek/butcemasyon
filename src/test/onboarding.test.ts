import { describe, expect, it } from "vitest";
import { getGuestRoute } from "@/budget/onboarding";

describe("getGuestRoute", () => {
  it("sends a first-time visitor to onboarding", () => {
    expect(getGuestRoute(false)).toBe("/welcome");
  });

  it("sends a returning visitor directly to authentication", () => {
    expect(getGuestRoute(true)).toBe("/auth");
  });
});
