import type { AppData } from "../domain/types";

export interface RecoveryPoint {
  id: string;
  createdAt: string;
  data: AppData;
  sequence?: number;
}

export interface DataRepository {
  load(): Promise<AppData>;
  save(data: AppData): Promise<void>;
  replace(data: AppData): Promise<void>;
  listRecoveryPoints(): Promise<RecoveryPoint[]>;
}

export function normalizeAppData(data: AppData): AppData {
  data.weights ??= [];
  data.settings ??= { displayName: "Adventurer", theme: "system" };
  return data;
}

export const emptyData = (): AppData => ({
  schemaVersion: 1,
  exercises: [],
  routines: [],
  sessions: [],
  weights: [],
  settings: { displayName: "Adventurer", theme: "system" }
});

export class MemoryRepository implements DataRepository {
  private recoveryPoints: RecoveryPoint[] = [];
  private recoverySequence = 0;
  constructor(private data: AppData = emptyData()) {}
  async load(): Promise<AppData> {
    return normalizeAppData(structuredClone(this.data));
  }
  async save(data: AppData): Promise<void> {
    if (JSON.stringify(this.data) !== JSON.stringify(data)) {
      this.recoveryPoints.unshift({
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        data: structuredClone(this.data),
        sequence: ++this.recoverySequence
      });
      this.recoveryPoints = this.recoveryPoints.slice(0, 5);
    }
    this.data = structuredClone(data);
  }
  async replace(data: AppData): Promise<void> {
    await this.save(data);
  }
  async listRecoveryPoints(): Promise<RecoveryPoint[]> {
    return structuredClone(this.recoveryPoints).map((point) => ({
      ...point,
      data: normalizeAppData(point.data)
    }));
  }
}
