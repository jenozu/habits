import { createDefaultState } from "../lib/defaults";
import { isV2State, migrateV2ToV3, migrateV3ToV4, migrateV4ToV5 } from "../lib/migrations";
import type { AppState, AppStateV3, AppStateV4 } from "../types/domain";
import { validateAppState, validateV3State, validateV4State } from "./schema";

export const V2_STORAGE_KEY = "habit-tracker-v2";
export const V3_STORAGE_KEY = "habit-tracker-v3";
export const V4_STORAGE_KEY = "habit-tracker-v4";
export const V5_STORAGE_KEY = "habit-tracker-v5";
export const V2_RECOVERY_KEY = "habit-tracker-v2-recovery";
export const V3_RECOVERY_KEY = "habit-tracker-v3-recovery";
export const V4_RECOVERY_KEY = "habit-tracker-v4-recovery";

export type LoadResult =
  | { status: "ok" | "migrated" | "fresh"; state: AppState; recoveryRaw?: string }
  | { status: "error"; state: AppState; raw: string; source: "v2" | "v3" | "v4" | "v5"; message: string };

export function loadAppState(storage: Storage, now = new Date()): LoadResult {
  const v5Raw = storage.getItem(V5_STORAGE_KEY);
  if (v5Raw) {
    try {
      const parsed: unknown = JSON.parse(v5Raw);
      if (!validateAppState(parsed)) throw new Error("Stored V5 data does not match the expected schema.");
      return { status: "ok", state: parsed };
    } catch (error) {
      return { status: "error", state: createDefaultState(now), raw: v5Raw, source: "v5", message: error instanceof Error ? error.message : "V5 data could not be read." };
    }
  }

  const v4Raw = storage.getItem(V4_STORAGE_KEY);
  if (v4Raw) {
    try {
      const parsed: unknown = JSON.parse(v4Raw);
      if (!validateV4State(parsed)) throw new Error("Stored V4 data does not match the expected schema.");
      const state = migrateV4ToV5(parsed as AppStateV4);
      if (!validateAppState(state)) throw new Error("Migrated data failed V5 verification.");
      storage.setItem(V4_RECOVERY_KEY, v4Raw);
      storage.setItem(V5_STORAGE_KEY, JSON.stringify(state));
      const verification: unknown = JSON.parse(storage.getItem(V5_STORAGE_KEY) ?? "null");
      if (!validateAppState(verification)) throw new Error("The migrated V5 save could not be verified.");
      return { status: "migrated", state, recoveryRaw: v4Raw };
    } catch (error) {
      return { status: "error", state: createDefaultState(now), raw: v4Raw, source: "v4", message: error instanceof Error ? error.message : "V4 data could not be read." };
    }
  }

  const v3Raw = storage.getItem(V3_STORAGE_KEY);
  if (v3Raw) {
    try {
      const parsed: unknown = JSON.parse(v3Raw);
      if (!validateV3State(parsed)) throw new Error("Stored V3 data does not match the expected schema.");
      const state = migrateV4ToV5(migrateV3ToV4(parsed as AppStateV3));
      if (!validateAppState(state)) throw new Error("Migrated data failed V5 verification.");
      storage.setItem(V3_RECOVERY_KEY, v3Raw);
      storage.setItem(V5_STORAGE_KEY, JSON.stringify(state));
      const verification: unknown = JSON.parse(storage.getItem(V5_STORAGE_KEY) ?? "null");
      if (!validateAppState(verification)) throw new Error("The migrated V5 save could not be verified.");
      return { status: "migrated", state, recoveryRaw: v3Raw };
    } catch (error) {
      return { status: "error", state: createDefaultState(now), raw: v3Raw, source: "v3", message: error instanceof Error ? error.message : "V3 data could not be read." };
    }
  }

  const v2Raw = storage.getItem(V2_STORAGE_KEY);
  if (!v2Raw) return { status: "fresh", state: createDefaultState(now) };
  try {
    const parsed: unknown = JSON.parse(v2Raw);
    if (!isV2State(parsed)) throw new Error("Stored V2 data does not match the expected legacy format.");
    const v3 = migrateV2ToV3(parsed, now);
    if (!validateV3State(v3)) throw new Error("Migrated data failed V3 verification.");
    const state = migrateV4ToV5(migrateV3ToV4(v3));
    if (!validateAppState(state)) throw new Error("Migrated data failed V5 verification.");
    storage.setItem(V2_RECOVERY_KEY, v2Raw);
    storage.setItem(V5_STORAGE_KEY, JSON.stringify(state));
    const verification: unknown = JSON.parse(storage.getItem(V5_STORAGE_KEY) ?? "null");
    if (!validateAppState(verification)) throw new Error("The migrated V5 save could not be verified.");
    return { status: "migrated", state, recoveryRaw: v2Raw };
  } catch (error) {
    if (!storage.getItem(V2_RECOVERY_KEY)) storage.setItem(V2_RECOVERY_KEY, v2Raw);
    return { status: "error", state: createDefaultState(now), raw: v2Raw, source: "v2", message: error instanceof Error ? error.message : "V2 data could not be migrated." };
  }
}

export function saveAppState(storage: Storage, state: AppState): void {
  if (!validateAppState(state)) throw new Error("Refusing to save invalid V5 data.");
  storage.setItem(V5_STORAGE_KEY, JSON.stringify(state));
}
