import type { AppData } from "../domain/types";

export interface DataRepository {
  load(): Promise<AppData>;
  save(data: AppData): Promise<void>;
  replace(data: AppData): Promise<void>;
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
  constructor(private data: AppData = emptyData()) {}
  async load(): Promise<AppData> {
    return structuredClone(this.data);
  }
  async save(data: AppData): Promise<void> {
    this.data = structuredClone(data);
  }
  async replace(data: AppData): Promise<void> {
    await this.save(data);
  }
}
