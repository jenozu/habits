import { createDefaultState } from "../lib/defaults";
import { isV2State, migrateV2ToV3 } from "../lib/migrations";
import type { AppStateV3 } from "../types/domain";
import { validateAppState } from "./schema";

export const V2_STORAGE_KEY = "habit-tracker-v2";
export const V3_STORAGE_KEY = "habit-tracker-v3";
export const V2_RECOVERY_KEY = "habit-tracker-v2-recovery";

export type LoadResult =
  | { status: "ok" | "migrated" | "fresh"; state: AppStateV3; recoveryRaw?: string }
  | { status: "error"; state: AppStateV3; raw: string; source: "v2" | "v3"; message: string };

export function loadAppState(storage: Storage, now = new Date()): LoadResult {
  const v3Raw = storage.getItem(V3_STORAGE_KEY);
  if (v3Raw) {
    try {
      const parsed: unknown = JSON.parse(v3Raw);
      if (!validateAppState(parsed)) throw new Error("Stored V3 data does not match the expected schema.");
      return { status: "ok", state: parsed };
    } catch (error) {
      return { status: "error", state: createDefaultState(now), raw: v3Raw, source: "v3", message: error instanceof Error ? error.message : "V3 data could not be read." };
    }
  }

  const v2Raw = storage.getItem(V2_STORAGE_KEY);
  if (!v2Raw) return { status: "fresh", state: createDefaultState(now) };
  try {
    const parsed: unknown = JSON.parse(v2Raw);
    if (!isV2State(parsed)) throw new Error("Stored V2 data does not match the expected legacy format.");
    const state = migrateV2ToV3(parsed, now);
    if (!validateAppState(state)) throw new Error("Migrated data failed V3 verification.");
    storage.setItem(V2_RECOVERY_KEY, v2Raw);
    storage.setItem(V3_STORAGE_KEY, JSON.stringify(state));
    const verification: unknown = JSON.parse(storage.getItem(V3_STORAGE_KEY) ?? "null");
    if (!validateAppState(verification)) throw new Error("The migrated V3 save could not be verified.");
    return { status: "migrated", state, recoveryRaw: v2Raw };
  } catch (error) {
    if (!storage.getItem(V2_RECOVERY_KEY)) storage.setItem(V2_RECOVERY_KEY, v2Raw);
    return { status: "error", state: createDefaultState(now), raw: v2Raw, source: "v2", message: error instanceof Error ? error.message : "V2 data could not be migrated." };
  }
}

export function saveAppState(storage: Storage, state: AppStateV3): void {
  if (!validateAppState(state)) throw new Error("Refusing to save invalid V3 data.");
  storage.setItem(V3_STORAGE_KEY, JSON.stringify(state));
}
