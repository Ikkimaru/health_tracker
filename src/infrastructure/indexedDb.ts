import { emptyData, type DataRepository, type RecoveryPoint } from "../application/store";
import type { AppData } from "../domain/types";

const DATABASE = "health-quest";
const STORE = "app-data";
const RECOVERY_STORE = "recovery-points";
const KEY = "current";

const requestResult = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });

export class IndexedDbRepository implements DataRepository {
  private async open(): Promise<IDBDatabase> {
    const request = indexedDB.open(DATABASE, 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
      if (!request.result.objectStoreNames.contains(RECOVERY_STORE)) {
        request.result.createObjectStore(RECOVERY_STORE, { keyPath: "id" });
      }
    };
    return requestResult(request);
  }

  async load(): Promise<AppData> {
    const database = await this.open();
    try {
      const transaction = database.transaction(STORE, "readonly");
      return (
        ((await requestResult(transaction.objectStore(STORE).get(KEY))) as AppData | undefined) ??
        emptyData()
      );
    } finally {
      database.close();
    }
  }

  async save(data: AppData): Promise<void> {
    const database = await this.open();
    try {
      const transaction = database.transaction([STORE, RECOVERY_STORE], "readwrite");
      const completed = new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () =>
          reject(transaction.error ?? new Error("Unable to save local data"));
        transaction.onabort = () => reject(transaction.error ?? new Error("Save was cancelled"));
      });
      const currentStore = transaction.objectStore(STORE);
      const recoveryStore = transaction.objectStore(RECOVERY_STORE);
      const current = (await requestResult(currentStore.get(KEY))) as AppData | undefined;
      if (current && JSON.stringify(current) !== JSON.stringify(data)) {
        const existingPoints = (await requestResult(recoveryStore.getAll())) as RecoveryPoint[];
        const point: RecoveryPoint = {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          data: structuredClone(current),
          sequence: Math.max(0, ...existingPoints.map(({ sequence }) => sequence ?? 0)) + 1
        };
        await requestResult(recoveryStore.add(point));
        [...existingPoints, point]
          .sort(
            (a, b) =>
              (b.sequence ?? 0) - (a.sequence ?? 0) || b.createdAt.localeCompare(a.createdAt)
          )
          .slice(5)
          .forEach(({ id }) => recoveryStore.delete(id));
      }
      await requestResult(currentStore.put(structuredClone(data), KEY));
      await completed;
    } finally {
      database.close();
    }
  }

  async replace(data: AppData): Promise<void> {
    await this.save(data);
  }

  async listRecoveryPoints(): Promise<RecoveryPoint[]> {
    const database = await this.open();
    try {
      const transaction = database.transaction(RECOVERY_STORE, "readonly");
      const points = (await requestResult(
        transaction.objectStore(RECOVERY_STORE).getAll()
      )) as RecoveryPoint[];
      return points.sort(
        (a, b) => (b.sequence ?? 0) - (a.sequence ?? 0) || b.createdAt.localeCompare(a.createdAt)
      );
    } finally {
      database.close();
    }
  }
}
