import { describe, expect, it } from "vitest";
import { emptyData } from "../src/application/store";
import { todayKey } from "../src/domain/rules";
import { todayView } from "../src/ui/views";

describe("Today weight capture", () => {
  it("hides the capture form after today's weight is stored", () => {
    const data = emptyData();
    expect(todayView(data)).toContain('id="today-weight-form"');

    data.weights.push({ date: todayKey(), weightKg: 80 });
    expect(todayView(data)).not.toContain('id="today-weight-form"');
  });
});
