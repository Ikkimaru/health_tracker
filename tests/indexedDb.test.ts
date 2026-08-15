import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { emptyData } from "../src/application/store";
import { IndexedDbRepository } from "../src/infrastructure/indexedDb";

describe("local IndexedDB repository", () => {
  beforeEach(async () => {
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase("health-quest");
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    });
  });
  it("starts empty and preserves saved application data", async () => {
    const repository = new IndexedDbRepository();
    expect((await repository.load()).schemaVersion).toBe(1);
    const data = emptyData();
    data.settings.displayName = "Local user";
    await repository.save(data);
    expect((await repository.load()).settings.displayName).toBe("Local user");
  });

  it("atomically replaces the current dataset", async () => {
    const repository = new IndexedDbRepository();
    const replacement = emptyData();
    replacement.settings.theme = "dark";
    await repository.replace(replacement);
    expect(await repository.load()).toEqual(replacement);
  });

  it("keeps the five newest distinct pre-save recovery points", async () => {
    const repository = new IndexedDbRepository();
    const data = emptyData();
    data.settings.displayName = "Version 0";
    await repository.save(data);
    for (let version = 1; version <= 7; version += 1) {
      data.settings.displayName = `Version ${version}`;
      await repository.save(data);
    }

    const points = await repository.listRecoveryPoints();
    expect(points).toHaveLength(5);
    expect(points[0]?.data.settings.displayName).toBe("Version 6");
    expect(points[4]?.data.settings.displayName).toBe("Version 2");

    await repository.replace(points[0]!.data);
    expect((await repository.load()).settings.displayName).toBe("Version 6");
    expect((await repository.listRecoveryPoints())[0]?.data.settings.displayName).toBe("Version 7");
  });

  it("normalizes recovery points created before weight tracking", async () => {
    const repository = new IndexedDbRepository();
    await repository.save(emptyData());
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("health-quest", 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const legacyData = emptyData() as Partial<ReturnType<typeof emptyData>>;
    delete legacyData.weights;
    const transaction = database.transaction("recovery-points", "readwrite");
    transaction.objectStore("recovery-points").put({
      id: "legacy",
      createdAt: "2026-08-01T00:00:00.000Z",
      data: legacyData,
      sequence: 1
    });
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();

    expect((await repository.listRecoveryPoints())[0]?.data.weights).toEqual([]);
  });
});
