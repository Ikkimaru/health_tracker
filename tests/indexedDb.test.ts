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
});
