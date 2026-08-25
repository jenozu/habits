import fixture from "./fixtures/v2.json";
import { migrateV2ToV3, migrateV3ToV4, migrateV4ToV5, type V2State } from "../lib/migrations";
import { loadAppState, V2_RECOVERY_KEY, V2_STORAGE_KEY, V3_RECOVERY_KEY, V3_STORAGE_KEY, V4_RECOVERY_KEY, V4_STORAGE_KEY, V5_STORAGE_KEY } from "../storage/app-store";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe("V2 to V3 migration", () => {
  const now = new Date("2026-08-20T16:00:00Z");

  it("characterizes and preserves existing V2 behavior without inventing detail", () => {
    const state = migrateV2ToV3(fixture as V2State, now);
    expect(state.schemaVersion).toBe(3);
    expect(state.routines).toHaveLength(2);
    expect(state.routines[0].tasks[2]).toMatchObject({ required: false, countsTowardProgress: false });
    expect(state.checkIns).toHaveLength(1);
    expect(state.checkIns[0].completionPercent).toBe(50);
    expect(state.routines[1].schedule).toEqual({ type: "manual" });
    expect(state.legacyDailySnapshots).toEqual([
      { date: "2026-08-18", completionPercent: 100, importedFrom: "v2" },
      { date: "2026-08-19", completionPercent: 50, importedFrom: "v2" },
    ]);
  });

  it("preserves journal entries and all legacy media references", () => {
    const state = migrateV2ToV3(fixture as V2State, now);
    expect(state.journalEntries[0].attachmentIds).toEqual(["photo-1", "audio-1"]);
    expect(state.attachments.map((value) => value.id)).toEqual(["photo-1", "audio-1"]);
  });

  it("is idempotent", () => {
    const first = migrateV2ToV3(fixture as V2State, now);
    expect(migrateV2ToV3(first, now)).toBe(first);
    expect(migrateV2ToV3(fixture as V2State, now)).toEqual(first);
  });

  it("keeps the original payload as a recovery copy and verifies V5", () => {
    const storage = new MemoryStorage();
    const raw = JSON.stringify(fixture);
    storage.setItem(V2_STORAGE_KEY, raw);
    const result = loadAppState(storage, now);
    expect(result.status).toBe("migrated");
    expect(storage.getItem(V2_STORAGE_KEY)).toBe(raw);
    expect(storage.getItem(V2_RECOVERY_KEY)).toBe(raw);
    expect(JSON.parse(storage.getItem(V5_STORAGE_KEY)!)).toMatchObject({ schemaVersion: 5, standaloneTasks: [], settings: { theme: "light" } });
  });

  it("upgrades V3 exactly once and preserves the V3 payload", () => {
    const storage = new MemoryStorage();
    const v3 = migrateV2ToV3(fixture as V2State, now);
    const raw = JSON.stringify(v3);
    storage.setItem(V3_STORAGE_KEY, raw);

    const first = loadAppState(storage, now);
    expect(first).toMatchObject({ status: "migrated", state: { schemaVersion: 5, standaloneTasks: [], settings: { theme: "light" } } });
    expect(storage.getItem(V3_STORAGE_KEY)).toBe(raw);
    expect(storage.getItem(V3_RECOVERY_KEY)).toBe(raw);

    const second = loadAppState(storage, now);
    expect(second).toMatchObject({ status: "ok", state: first.state });
    expect(migrateV4ToV5(first.state)).toBe(first.state);
  });

  it("upgrades V4 to light mode once and preserves every existing collection", () => {
    const storage = new MemoryStorage();
    const v4 = migrateV3ToV4(migrateV2ToV3(fixture as V2State, now));
    v4.settings.theme = "system";
    const raw = JSON.stringify(v4);
    storage.setItem(V4_STORAGE_KEY, raw);

    const first = loadAppState(storage, now);
    expect(first).toMatchObject({ status: "migrated", state: { schemaVersion: 5, settings: { theme: "light" } } });
    expect(first.state.routines).toEqual(v4.routines);
    expect(first.state.checkIns).toEqual(v4.checkIns);
    expect(first.state.journalEntries).toEqual(v4.journalEntries);
    expect(storage.getItem(V4_STORAGE_KEY)).toBe(raw);
    expect(storage.getItem(V4_RECOVERY_KEY)).toBe(raw);

    const second = loadAppState(storage, now);
    expect(second).toMatchObject({ status: "ok", state: first.state });
  });

  it("never erases corrupt storage and returns downloadable raw data", () => {
    const storage = new MemoryStorage();
    storage.setItem(V2_STORAGE_KEY, "{broken-json");
    const result = loadAppState(storage, now);
    expect(result).toMatchObject({ status: "error", raw: "{broken-json", source: "v2" });
    expect(storage.getItem(V2_STORAGE_KEY)).toBe("{broken-json");
    expect(storage.getItem(V2_RECOVERY_KEY)).toBe("{broken-json");
    expect(storage.getItem(V5_STORAGE_KEY)).toBeNull();
  });
});
