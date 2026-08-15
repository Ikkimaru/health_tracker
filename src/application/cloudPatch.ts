import type { AppData } from "../domain/types";

export interface PositionedValue {
  position: number;
  value: unknown;
}

export interface AppPatch {
  schemaVersion: 1;
  settings?: AppData["settings"];
  exercises?: { upserts: PositionedValue[]; deletes: string[] };
  routines?: { upserts: PositionedValue[]; deletes: string[] };
  sessions?: { upserts: PositionedValue[]; deletes: string[] };
  weights?: { upserts: PositionedValue[]; deletes: string[] };
}

const same = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

function arrayPatch<T>(
  before: T[],
  after: T[],
  key: (value: T) => string,
  trackPosition = true
): { upserts: PositionedValue[]; deletes: string[] } | undefined {
  const previous = new Map(before.map((value) => [key(value), value]));
  const currentKeys = new Set(after.map(key));
  const upserts = after.flatMap((value, position) => {
    const oldPosition = before.findIndex((item) => key(item) === key(value));
    return !same(previous.get(key(value)), value) || (trackPosition && oldPosition !== position)
      ? [{ position, value }]
      : [];
  });
  const deletes = before.map(key).filter((id) => !currentKeys.has(id));
  return upserts.length || deletes.length ? { upserts, deletes } : undefined;
}

export function createAppPatch(before: AppData, after: AppData): AppPatch {
  const patch: AppPatch = { schemaVersion: 1 };
  if (!same(before.settings, after.settings)) patch.settings = structuredClone(after.settings);
  patch.exercises = arrayPatch(before.exercises, after.exercises, ({ id }) => id);
  patch.routines = arrayPatch(before.routines, after.routines, ({ id }) => id);
  patch.sessions = arrayPatch(before.sessions, after.sessions, ({ id }) => id);
  patch.weights = arrayPatch(before.weights, after.weights, ({ date }) => date, false);
  return patch;
}

export function patchHasChanges(patch: AppPatch): boolean {
  return Boolean(
    patch.settings || patch.exercises || patch.routines || patch.sessions || patch.weights
  );
}
