import type { WeightEntry, WeightTrendMethod } from "./types";

const DAY_MS = 86_400_000;
const dayNumber = (date: string) => Date.parse(`${date}T00:00:00Z`) / DAY_MS;

export interface WeightTrend {
  slopePerDay: number;
  intercept: number;
  valueAt(day: number): number;
}

export function calculateWeightTrend(
  entries: WeightEntry[],
  method: WeightTrendMethod
): WeightTrend | undefined {
  const points = [...entries]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((entry) => ({ x: dayNumber(entry.date), y: entry.weightKg }));
  if (points.length < 2 || points[0]!.x === points.at(-1)!.x) return undefined;

  let slope: number;
  if (method === "theil-sen") {
    const slopes: number[] = [];
    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        slopes.push((points[j]!.y - points[i]!.y) / (points[j]!.x - points[i]!.x));
      }
    }
    slopes.sort((a, b) => a - b);
    slope = slopes[Math.floor(slopes.length / 2)]!;
    const intercepts = points.map(({ x, y }) => y - slope * x).sort((a, b) => a - b);
    const intercept = intercepts[Math.floor(intercepts.length / 2)]!;
    return { slopePerDay: slope, intercept, valueAt: (day) => intercept + slope * day };
  }

  const newest = points.at(-1)!.x;
  const weighted = points.map((point) => ({
    ...point,
    weight: method === "weighted" ? Math.pow(0.5, (newest - point.x) / 30) : 1
  }));
  const totalWeight = weighted.reduce((sum, point) => sum + point.weight, 0);
  const meanX = weighted.reduce((sum, point) => sum + point.x * point.weight, 0) / totalWeight;
  const meanY = weighted.reduce((sum, point) => sum + point.y * point.weight, 0) / totalWeight;
  const denominator = weighted.reduce(
    (sum, point) => sum + point.weight * Math.pow(point.x - meanX, 2),
    0
  );
  slope =
    weighted.reduce((sum, point) => sum + point.weight * (point.x - meanX) * (point.y - meanY), 0) /
    denominator;
  const intercept = meanY - slope * meanX;
  return { slopePerDay: slope, intercept, valueAt: (day) => intercept + slope * day };
}

export function projectedGoalDate(
  entries: WeightEntry[],
  goalWeightKg: number | undefined,
  method: WeightTrendMethod
): string | undefined {
  if (goalWeightKg === undefined || !entries.length) return undefined;
  const trend = calculateWeightTrend(entries, method);
  if (!trend || Math.abs(trend.slopePerDay) < 0.0001) return undefined;
  const latest = [...entries].sort((a, b) => b.date.localeCompare(a.date))[0]!;
  const targetDay = (goalWeightKg - trend.intercept) / trend.slopePerDay;
  if (!Number.isFinite(targetDay) || targetDay <= dayNumber(latest.date)) return undefined;
  return new Date(targetDay * DAY_MS).toISOString().slice(0, 10);
}
