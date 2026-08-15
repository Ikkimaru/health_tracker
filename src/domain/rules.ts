import type { Achievement, DailySession, Exercise, Progress, Routine } from "./types";

export const todayKey = (date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export function isScheduled(routine: Routine, date: string): boolean {
  const weekday = new Date(`${date}T12:00:00`).getDay();
  return routine.schedule.dates.includes(date) || routine.schedule.weekdays.includes(weekday);
}

export function createSession(
  date: string,
  routines: Routine[],
  exercises: Exercise[]
): DailySession | undefined {
  const scheduled = routines.filter((routine) => !routine.archived && isScheduled(routine, date));
  if (scheduled.length === 0) return undefined;
  const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  return {
    id: crypto.randomUUID(),
    date,
    routineIds: scheduled.map(({ id }) => id),
    createdAt: new Date().toISOString(),
    exercises: scheduled.flatMap((routine) =>
      routine.items.flatMap((item) => {
        const source = exerciseById.get(item.exerciseId);
        if (!source || source.archived) return [];
        const count = item.sets ?? source.sets;
        const target = item.target ?? source.target;
        return [
          {
            id: crypto.randomUUID(),
            sourceExerciseId: source.id,
            name: source.name,
            kind: source.kind,
            required: item.required,
            weightKg: item.weightKg ?? source.weightKg,
            notes: source.notes,
            prescriptions: Array.from({ length: count }, () => ({
              id: crypto.randomUUID(),
              target,
              completed: false
            }))
          }
        ];
      })
    )
  };
}

export const exerciseComplete = (exercise: DailySession["exercises"][number]): boolean =>
  exercise.prescriptions.length > 0 && exercise.prescriptions.every(({ completed }) => completed);

export const dayComplete = (session: DailySession): boolean => {
  const required = session.exercises.filter(({ required }) => required);
  return required.length > 0 && required.every(exerciseComplete);
};

const achievement = (
  id: string,
  title: string,
  description: string,
  unlocked: boolean
): Achievement => ({ id, title, description, unlocked });

export function calculateProgress(sessions: DailySession[], today = todayKey()): Progress {
  const completedExercises = sessions
    .flatMap(({ exercises }) => exercises)
    .filter(exerciseComplete).length;
  const completedDates = new Set(sessions.filter(dayComplete).map(({ date }) => date));
  const xp = completedExercises * 10 + completedDates.size * 25;
  const scheduled = [...sessions]
    .filter(({ date }) => date <= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  let longestStreak = 0;
  let run = 0;
  for (const session of scheduled) {
    run = dayComplete(session) ? run + 1 : 0;
    longestStreak = Math.max(longestStreak, run);
  }
  let currentStreak = 0;
  for (let index = scheduled.length - 1; index >= 0; index -= 1) {
    if (!dayComplete(scheduled[index]!)) break;
    currentStreak += 1;
  }
  return {
    xp,
    level: Math.floor(xp / 100) + 1,
    completedExercises,
    completedDays: completedDates.size,
    currentStreak,
    longestStreak,
    achievements: [
      achievement(
        "first-exercise",
        "First move",
        "Complete your first exercise.",
        completedExercises >= 1
      ),
      achievement(
        "first-day",
        "Quest complete",
        "Complete your first scheduled day.",
        completedDates.size >= 1
      ),
      ...[3, 7, 30].map((count) =>
        achievement(
          `streak-${count}`,
          `${count}-day streak`,
          `Complete ${count} scheduled days in a row.`,
          longestStreak >= count
        )
      ),
      ...[10, 50, 100].map((count) =>
        achievement(
          `exercises-${count}`,
          `${count} exercises`,
          `Complete ${count} exercises.`,
          completedExercises >= count
        )
      )
    ]
  };
}
