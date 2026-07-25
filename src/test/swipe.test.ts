import { describe, expect, it } from "vitest";
import { getSwipeOutcome } from "../budget/swipe";

describe("getSwipeOutcome", () => {
  it("opens edit controls for a short right swipe and edits after the commit threshold", () => {
    expect(getSwipeOutcome(40)).toBe("reveal-edit");
    expect(getSwipeOutcome(120)).toBe("edit");
  });

  it("opens delete controls for a short left swipe and deletes after the commit threshold", () => {
    expect(getSwipeOutcome(-40)).toBe("reveal-delete");
    expect(getSwipeOutcome(-120)).toBe("delete");
  });

  it("returns to rest for small movements", () => {
    expect(getSwipeOutcome(12)).toBe("close");
    expect(getSwipeOutcome(-12)).toBe("close");
  });
});
