import { describe, expect, it, vi } from "vitest";
import {
  calculateProgress,
  createSession,
  dayComplete,
  exerciseComplete,
  isScheduled
} from "../src/domain/rules";
import type { DailySession, Exercise, Routine } from "../src/domain/types";

const exercise: Exercise = {
  id: "pushups",
  name: "Push-ups",
  kind: "reps",
  sets: 2,
  target: 10,
  archived: false,
  createdAt: "2026-01-01T00:00:00Z"
};
const routine: Routine = {
  id: "morning",
  name: "Morning",
  archived: false,
  createdAt: "2026-01-01T00:00:00Z",
  schedule: { weekdays: [1], dates: [] },
  items: [{ id: "item", exerciseId: exercise.id, required: true }]
};

describe("daily scheduling", () => {
  it("schedules a routine on its weekday and on explicit dates", () => {
    expect(isScheduled(routine, "2026-08-17")).toBe(true);
    expect(
      isScheduled({ ...routine, schedule: { weekdays: [], dates: ["2026-08-18"] } }, "2026-08-18")
    ).toBe(true);
    expect(isScheduled(routine, "2026-08-18")).toBe(false);
  });

  it("snapshots the prescription so later exercise edits do not change the session", () => {
    vi.stubGlobal("crypto", {
      randomUUID: () => Math.random().toString(),
      getRandomValues: globalThis.crypto.getRandomValues,
      subtle: globalThis.crypto.subtle
    });
    const session = createSession("2026-08-17", [routine], [exercise])!;
    exercise.target = 99;
    expect(session.exercises[0]?.prescriptions.map(({ target }) => target)).toEqual([10, 10]);
    vi.unstubAllGlobals();
  });
});

const completedSession = (date: string, completed = true): DailySession => ({
  id: date,
  date,
  routineIds: ["routine"],
  createdAt: `${date}T06:00:00Z`,
  exercises: [
    {
      id: `${date}-exercise`,
      sourceExerciseId: "pushups",
      name: "Push-ups",
      kind: "reps",
      required: true,
      prescriptions: [{ id: `${date}-set`, target: 10, completed }]
    }
  ]
});

describe("completion and rewards", () => {
  it("requires every set of every required exercise to complete a day", () => {
    const session = completedSession("2026-08-15", false);
    expect(exerciseComplete(session.exercises[0]!)).toBe(false);
    expect(dayComplete(session)).toBe(false);
    session.exercises[0]!.prescriptions[0]!.completed = true;
    expect(dayComplete(session)).toBe(true);
  });

  it("derives XP once from records rather than repeated checkbox events", () => {
    const progress = calculateProgress([completedSession("2026-08-15")], "2026-08-15");
    expect(progress).toMatchObject({ xp: 35, level: 1, completedExercises: 1, completedDays: 1 });
  });

  it("recalculates streaks and achievements after historical corrections", () => {
    const sessions = [
      completedSession("2026-08-13"),
      completedSession("2026-08-14"),
      completedSession("2026-08-15")
    ];
    expect(calculateProgress(sessions, "2026-08-15").currentStreak).toBe(3);
    sessions[1]!.exercises[0]!.prescriptions[0]!.completed = false;
    const corrected = calculateProgress(sessions, "2026-08-15");
    expect(corrected.currentStreak).toBe(1);
    expect(corrected.achievements.find(({ id }) => id === "streak-3")?.unlocked).toBe(false);
  });

  it("does not break a streak when an unscheduled rest day passes", () => {
    const sessions = [completedSession("2026-08-13"), completedSession("2026-08-15")];
    expect(calculateProgress(sessions, "2026-08-16").currentStreak).toBe(2);
    expect(calculateProgress(sessions, "2026-08-16").longestStreak).toBe(2);
  });
});
