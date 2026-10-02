import { listAllEvents, listAllUsage } from "./repo";
import { getSettings } from "./settings";

// 사용량 한도와 지표 (명세서 39장, 40.5) — 로컬 MVP에서는 이 브라우저 기준으로 집계한다

const startOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
};
const startOfDay = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
};

export interface UsageSnapshot {
  monthGenerations: number;
  dayGenerations: number;
  monthRewrites: number;
  monthlyLimit: number;
  dailyLimit: number;
  rewriteLimit: number;
}

export async function usageSnapshot(): Promise<UsageSnapshot> {
  const s = getSettings();
  const events = await listAllEvents();
  const month = startOfMonth();
  const day = startOfDay();
  const gens = events.filter((e) => e.eventType === "generate");
  const rewrites = events.filter((e) => (e.eventType === "regenerate" || e.eventType === "section_regenerate") && e.createdAt >= month);
  return {
    monthGenerations: gens.filter((e) => e.createdAt >= month).length,
    dayGenerations: gens.filter((e) => e.createdAt >= day).length,
    monthRewrites: rewrites.length,
    monthlyLimit: s.monthlyGenerationLimit,
    dailyLimit: s.dailyGenerationLimit,
    rewriteLimit: s.monthlyRewriteLimit,
  };
}

export async function checkGenerationAllowed(): Promise<string | null> {
  const u = await usageSnapshot();
  if (u.monthGenerations >= u.monthlyLimit) return `이번 달 생성 한도(${u.monthlyLimit}개)를 모두 사용했습니다. 설정에서 한도를 확인하세요.`;
  if (u.dayGenerations >= u.dailyLimit) return `오늘 생성 한도(${u.dailyLimit}개)를 모두 사용했습니다.`;
  return null;
}

export async function checkRewriteAllowed(): Promise<string | null> {
  const u = await usageSnapshot();
  return u.monthRewrites >= u.rewriteLimit ? `이번 달 재작성 한도(${u.rewriteLimit}회)를 모두 사용했습니다.` : null;
}

export interface Metrics {
  generatedContents: number;
  copiedContents: number;
  copyReadyContents: number;
  copyReadyRate: number | null;
  avgCostPerGeneration: number | null;
  totalCost: number;
  questionSkipRate: number | null;
  sectionRegenerations: number;
}

export async function metrics(answeredOrSkipped: { total: number; skipped: number }): Promise<Metrics> {
  const s = getSettings();
  const events = await listAllEvents();
  const usage = await listAllUsage();
  const copies = events.filter((e) => e.eventType === "copy_rich" || e.eventType === "copy_plain");
  const firstCopyByContent = new Map<string, number>();
  for (const c of copies.sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    if (!c.contentId || firstCopyByContent.has(c.contentId)) continue;
    const ratio = typeof c.payload.editRatio === "number" ? c.payload.editRatio : null;
    if (ratio !== null) firstCopyByContent.set(c.contentId, ratio);
  }
  const generated = events.filter((e) => e.eventType === "generate").reduce((n, e) => n + (Array.isArray(e.payload.platforms) ? e.payload.platforms.length : 1), 0);
  const ready = Array.from(firstCopyByContent.values()).filter((r) => r <= s.copyReadyThreshold).length;
  const gens = events.filter((e) => e.eventType === "generate").length;
  const totalCost = usage.reduce((n, u) => n + u.estimatedCostUsd, 0);
  return {
    generatedContents: generated,
    copiedContents: firstCopyByContent.size,
    copyReadyContents: ready,
    copyReadyRate: generated ? ready / generated : null,
    avgCostPerGeneration: gens ? totalCost / gens : null,
    totalCost,
    questionSkipRate: answeredOrSkipped.total ? answeredOrSkipped.skipped / answeredOrSkipped.total : null,
    sectionRegenerations: events.filter((e) => e.eventType === "section_regenerate").length,
  };
}
