import fixture from "./fixtures/v2.json";
import { migrateV2ToV3, type V2State } from "../lib/migrations";
import { loadAppState, V2_RECOVERY_KEY, V2_STORAGE_KEY, V3_STORAGE_KEY } from "../storage/app-store";

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

  it("keeps the original payload as a recovery copy and verifies V3", () => {
    const storage = new MemoryStorage();
    const raw = JSON.stringify(fixture);
    storage.setItem(V2_STORAGE_KEY, raw);
    const result = loadAppState(storage, now);
    expect(result.status).toBe("migrated");
    expect(storage.getItem(V2_STORAGE_KEY)).toBe(raw);
    expect(storage.getItem(V2_RECOVERY_KEY)).toBe(raw);
    expect(JSON.parse(storage.getItem(V3_STORAGE_KEY)!)).toMatchObject({ schemaVersion: 3 });
  });

  it("never erases corrupt storage and returns downloadable raw data", () => {
    const storage = new MemoryStorage();
    storage.setItem(V2_STORAGE_KEY, "{broken-json");
    const result = loadAppState(storage, now);
    expect(result).toMatchObject({ status: "error", raw: "{broken-json", source: "v2" });
    expect(storage.getItem(V2_STORAGE_KEY)).toBe("{broken-json");
    expect(storage.getItem(V2_RECOVERY_KEY)).toBe("{broken-json");
    expect(storage.getItem(V3_STORAGE_KEY)).toBeNull();
  });
});
