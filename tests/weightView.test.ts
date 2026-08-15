import { describe, expect, it } from "vitest";
import { emptyData } from "../src/application/store";
import { todayKey } from "../src/domain/rules";
import { weightView } from "../src/ui/views";

const dateDaysAgo = (days: number): string => {
  const date = new Date(`${todayKey()}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
};

describe("weight chart time scale", () => {
  it("anchors finite ranges to today and renders week-start date labels for daily dots", () => {
    const data = emptyData();
    data.settings.weightCalendarWeekStart = "monday";
    data.weights = [
      { date: dateDaysAgo(10), weightKg: 81 },
      { date: todayKey(), weightKg: 80 }
    ];

    const oneMonth = weightView(data, "1", "", "daily");
    const threeMonths = weightView(data, "3", "", "daily");
    const firstCircleX = (markup: string) => Number(markup.match(/<circle cx="([\d.]+)"/)?.[1]);

    expect(oneMonth).toContain('class="date-label daily"');
    expect(threeMonths).toContain('class="date-label ');
    expect(firstCircleX(threeMonths)).toBeGreaterThan(firstCircleX(oneMonth));
    expect(oneMonth.match(/class="date-label daily"/g)).toHaveLength(31);
    expect(threeMonths).not.toContain('class="date-label daily"');

    const trendStart = Number(oneMonth.match(/class="trend-line" x1="([\d.]+)"/)?.[1]);
    expect(trendStart).toBeCloseTo(firstCircleX(oneMonth));
    expect(oneMonth.match(/class="weight-value-label"/g)).toHaveLength(2);
    expect(oneMonth).toContain('class="crosshair horizontal"');
    expect(oneMonth).toContain('class="crosshair vertical"');
    expect(oneMonth).toContain('aria-label="Previous month"');
    expect(oneMonth).toMatch(/aria-label="Next month" disabled/);

    const editor = weightView(data, "1", todayKey(), "daily");
    expect(editor).toContain("Delete record");
    expect(editor).toContain(`data-delete-weight="${todayKey()}"`);
  });
});
