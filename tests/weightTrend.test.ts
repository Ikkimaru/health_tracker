import { describe, expect, it } from "vitest";
import { calculateWeightTrend, projectedGoalDate } from "../src/domain/weightTrend";
import type { WeightEntry } from "../src/domain/types";

const weights: WeightEntry[] = [
  { date: "2026-01-01", weightKg: 90 },
  { date: "2026-01-11", weightKg: 89 },
  { date: "2026-01-21", weightKg: 88 }
];

describe("weight trends", () => {
  it("fits a daily linear change and projects a future goal", () => {
    expect(calculateWeightTrend(weights, "linear")?.slopePerDay).toBeCloseTo(-0.1);
    expect(projectedGoalDate(weights, 85, "linear")).toBe("2026-02-20");
  });

  it("offers recent-weighted and outlier-resistant calculations", () => {
    const noisy = [...weights, { date: "2026-01-12", weightKg: 120 }];
    expect(calculateWeightTrend(noisy, "theil-sen")?.slopePerDay).toBeCloseTo(-0.1);
    expect(calculateWeightTrend(weights, "weighted")?.slopePerDay).toBeLessThan(0);
  });

  it("does not claim a goal date when the trend moves away from the goal", () => {
    expect(projectedGoalDate(weights, 95, "linear")).toBeUndefined();
  });
});
