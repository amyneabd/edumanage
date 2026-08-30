import { describe, expect, it } from "vitest";
import { currentPeriod, previousPeriod } from "./period.js";

describe("period helpers", () => {
  it("formats a date as YYYY-MM", () => {
    expect(currentPeriod(new Date(2026, 7, 28))).toBe("2026-08");
    expect(currentPeriod(new Date(2026, 0, 5))).toBe("2026-01");
  });

  it("pads single-digit months", () => {
    expect(currentPeriod(new Date(2025, 2, 1))).toBe("2025-03");
  });

  it("steps back one month within the same year", () => {
    expect(previousPeriod("2026-08")).toBe("2026-07");
  });

  it("rolls back across a year boundary", () => {
    expect(previousPeriod("2026-01")).toBe("2025-12");
  });
});
