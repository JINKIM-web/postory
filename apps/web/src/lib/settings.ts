import { useSyncExternalStore } from "react";

// 사용자 설정·화면 상태 — localStorage (브라우저마다 따로 저장, 비어 있어도 기본값으로 동작)

export interface Settings {
  // 사용량 한도 (명세서 40.5) — 로컬 MVP 기본값
  monthlyGenerationLimit: number;
  dailyGenerationLimit: number;
  monthlyRewriteLimit: number;
  // 생성 1건당 추정 비용 경고 기준 (USD)
  costAlertUsd: number;
  // Publish Readiness 점수 노출 (명세서 14장 — 1C에서 노출 여부 결정, 기본은 숨김)
  showReadinessScore: boolean;
  // Copy-ready 판정 편집 거리 기준 (미결 #10, 초기 가설 10%)
  copyReadyThreshold: number;
  // 마지막으로 쓴 입력값 (새 프로젝트 기본값)
  lastTone: string | null;
  lastPlatforms: string[] | null;
  rightPanelTab: "quality" | "evidence" | "versions";
  uploadNoticeDismissed: boolean;
  // 마지막 전체 백업 시각 (백업 안내용)
  lastBackupAt: string | null;
}

const DEFAULTS: Settings = {
  monthlyGenerationLimit: 20,
  dailyGenerationLimit: 10,
  monthlyRewriteLimit: 200,
  costAlertUsd: 0.2,
  showReadinessScore: false,
  copyReadyThreshold: 0.1,
  lastTone: null,
  lastPlatforms: null,
  rightPanelTab: "quality",
  uploadNoticeDismissed: false,
  lastBackupAt: null,
};

const KEY = "postory.settings.v1";
let cache: Settings | null = null;
const listeners = new Set<() => void>();

export function getSettings(): Settings {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = { ...DEFAULTS, ...(raw ? (JSON.parse(raw) as Partial<Settings>) : {}) };
  } catch {
    cache = { ...DEFAULTS };
  }
  return cache;
}

export function setSettings(patch: Partial<Settings>): void {
  cache = { ...getSettings(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // 저장소를 쓸 수 없으면(사생활 보호 모드 등) 이번 세션에서만 유지
  }
  for (const l of listeners) l();
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getSettings,
    getSettings,
  );
}
