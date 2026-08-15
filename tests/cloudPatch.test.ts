import { describe, expect, it } from "vitest";
import { emptyData } from "../src/application/store";
import { createAppPatch, patchHasChanges } from "../src/application/cloudPatch";

describe("incremental cloud patches", () => {
  it("sends only a changed weight date", () => {
    const before = emptyData();
    before.weights = [{ date: "2026-08-15", weightKg: 80 }];
    const after = structuredClone(before);
    after.weights[0]!.weightKg = 79.8;

    expect(createAppPatch(before, after)).toEqual({
      schemaVersion: 1,
      weights: {
        upserts: [{ position: 0, value: { date: "2026-08-15", weightKg: 79.8 } }],
        deletes: []
      }
    });
  });

  it("does not resend unrelated exercises when settings change", () => {
    const before = emptyData();
    before.exercises.push({
      id: "exercise-1",
      name: "Walk",
      kind: "distance",
      sets: 1,
      target: 2,
      archived: false,
      createdAt: "2026-08-15T00:00:00Z"
    });
    const after = structuredClone(before);
    after.settings.displayName = "Updated";
    const patch = createAppPatch(before, after);

    expect(patch.settings?.displayName).toBe("Updated");
    expect(patch.exercises).toBeUndefined();
    expect(patchHasChanges(patch)).toBe(true);
    expect(patchHasChanges(createAppPatch(after, after))).toBe(false);
  });

  it("represents a deleted weight by date without sending the calendar", () => {
    const before = emptyData();
    before.weights = [
      { date: "2026-08-14", weightKg: 81 },
      { date: "2026-08-15", weightKg: 80 }
    ];
    const after = structuredClone(before);
    after.weights.shift();

    expect(createAppPatch(before, after).weights).toEqual({
      upserts: [],
      deletes: ["2026-08-14"]
    });
  });
});
