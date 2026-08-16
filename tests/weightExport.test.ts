import { describe, expect, it } from "vitest";
import { createWeightExport, weightsForMonths } from "../src/application/weightExport";

const weights = [
  { date: "2026-01-31", weightKg: 82 },
  { date: "2026-02-01", weightKg: 81.5 },
  { date: "2026-03-15", weightKg: 80 }
];

describe("weight exports", () => {
  it("includes all recorded days in the selected months", () => {
    expect(weightsForMonths(weights, "2026-01", "2026-02")).toEqual(weights.slice(0, 2));
  });

  it("creates Excel-compatible CSV and Notepad text downloads", async () => {
    const excel = createWeightExport(weights, "2026-02", "2026-03", "excel");
    expect(excel.filename).toBe("weights-2026-02-to-2026-03.csv");
    expect(await excel.blob.text()).toContain("2026-02-01,81.5");
    const notepad = createWeightExport(weights, "2026-02", "2026-03", "notepad");
    expect(notepad.filename).toMatch(/\.txt$/);
    expect(await notepad.blob.text()).toContain("2026-03-15\t80");
  });

  it("creates a paginated PDF and rejects empty or reversed ranges", async () => {
    const many = Array.from({ length: 90 }, (_, index) => ({
      date: `2026-${String(Math.floor(index / 28) + 1).padStart(2, "0")}-${String((index % 28) + 1).padStart(2, "0")}`,
      weightKg: 90 - index / 10
    }));
    const pdf = createWeightExport(many, "2026-01", "2026-04", "pdf");
    expect(pdf.blob.type).toBe("application/pdf");
    expect(await pdf.blob.text()).toContain("/Count 3");
    expect(() => createWeightExport(weights, "2026-04", "2026-05", "excel")).toThrow(
      "No weight records"
    );
    expect(() => weightsForMonths(weights, "2026-03", "2026-02")).toThrow("start month");
  });
});
