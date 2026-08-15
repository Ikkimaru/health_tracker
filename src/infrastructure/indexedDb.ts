import { emptyData, type DataRepository } from "../application/store";
import type { AppData } from "../domain/types";

const DATABASE = "health-quest";
const STORE = "app-data";
const KEY = "current";

const requestResult = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });

export class IndexedDbRepository implements DataRepository {
  private async open(): Promise<IDBDatabase> {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
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
      const transaction = database.transaction(STORE, "readwrite");
      const completed = new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () =>
          reject(transaction.error ?? new Error("Unable to save local data"));
        transaction.onabort = () => reject(transaction.error ?? new Error("Save was cancelled"));
      });
      await requestResult(transaction.objectStore(STORE).put(structuredClone(data), KEY));
      await completed;
    } finally {
      database.close();
    }
  }

  async replace(data: AppData): Promise<void> {
    await this.save(data);
  }
}
