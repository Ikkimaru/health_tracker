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
});
