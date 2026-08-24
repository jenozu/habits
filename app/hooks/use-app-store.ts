"use client";

import { useEffect, useState } from "react";
import { createDefaultState } from "../lib/defaults";
import { loadAppState, saveAppState, V2_RECOVERY_KEY, V2_STORAGE_KEY, V3_STORAGE_KEY, type LoadResult } from "../storage/app-store";
import type { AppStateV3 } from "../types/domain";

export function useAppStore() {
  const [state, setState] = useState<AppStateV3>(() => createDefaultState());
  const [hydrated, setHydrated] = useState(false);
  const [loadResult, setLoadResult] = useState<LoadResult | null>(null);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    const result = loadAppState(window.localStorage);
    queueMicrotask(() => {
      setState(result.state);
      setLoadResult(result);
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!hydrated || loadResult?.status === "error") return;
    try {
      saveAppState(window.localStorage, state);
      queueMicrotask(() => setSaveError(""));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Changes could not be saved.";
      queueMicrotask(() => setSaveError(message));
    }
  }, [hydrated, loadResult?.status, state]);

  function resetAfterRecovery() {
    if (loadResult?.status !== "error") return;
    window.localStorage.setItem(`${loadResult.source}-invalid-recovery`, loadResult.raw);
    window.localStorage.removeItem(loadResult.source === "v2" ? V2_STORAGE_KEY : V3_STORAGE_KEY);
    if (loadResult.source === "v2") window.localStorage.setItem(V2_RECOVERY_KEY, loadResult.raw);
    const fresh = createDefaultState();
    saveAppState(window.localStorage, fresh);
    setState(fresh);
    setLoadResult({ status: "fresh", state: fresh });
  }

  return { state, setState, hydrated, loadResult, saveError, resetAfterRecovery };
}
