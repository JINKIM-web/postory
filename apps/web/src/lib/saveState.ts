import { useSyncExternalStore } from "react";

// 상단바 자동 저장 표시
type SaveState = "idle" | "saving" | "saved";

let state: SaveState = "idle";
const listeners = new Set<() => void>();

export function setSaveState(next: SaveState) {
  state = next;
  for (const l of listeners) l();
}

export async function withSaving<T>(fn: () => Promise<T>): Promise<T> {
  setSaveState("saving");
  try {
    return await fn();
  } finally {
    setSaveState("saved");
  }
}

export function useSaveState(): SaveState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
}
