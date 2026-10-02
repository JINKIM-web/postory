import type { Personalization, UserWord } from "@postory/shared";
import { getDb, notify, now, uid } from "./db";
import type { BrandProfileRecord, MemoryItemRecord, ProjectRecord, UserWordRecord, VoiceProfileRecord } from "./types";

// Phase 2A 개인화 저장소 (명세서 21·22장) — IndexedDB

// ---------- My Voice (한 사람당 하나) ----------

export async function getVoiceProfile(): Promise<VoiceProfileRecord | undefined> {
  return (await (await getDb()).getAll("voiceProfiles"))[0];
}

export async function saveVoiceProfile(data: Pick<VoiceProfileRecord, "samples" | "features">): Promise<void> {
  const db = await getDb();
  const existing = await getVoiceProfile();
  const ts = now();
  await db.put("voiceProfiles", { id: existing?.id ?? uid(), createdAt: existing?.createdAt ?? ts, updatedAt: ts, ...data });
  notify("voiceProfiles");
}

export async function deleteVoiceProfile(): Promise<void> {
  await (await getDb()).clear("voiceProfiles");
  notify("voiceProfiles");
}

// ---------- Brand Profile ----------

export async function listBrands(): Promise<BrandProfileRecord[]> {
  const all = await (await getDb()).getAll("brandProfiles");
  return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function emptyBrand(): BrandProfileRecord {
  const ts = now();
  return { id: uid(), name: "", description: "", products: "", targetCustomer: "", keyMessage: "", toneAndManner: "", industries: [], preferredPhrases: [], forbiddenWords: [], createdAt: ts, updatedAt: ts };
}

export async function saveBrand(brand: BrandProfileRecord): Promise<void> {
  await (await getDb()).put("brandProfiles", { ...brand, updatedAt: now() });
  notify("brandProfiles");
}

export async function deleteBrand(id: string): Promise<void> {
  await (await getDb()).delete("brandProfiles", id);
  notify("brandProfiles");
}

// ---------- 내 금칙어·선호 표현 (Level 4) ----------

export async function listUserWords(): Promise<UserWordRecord[]> {
  const all = await (await getDb()).getAll("userWords");
  return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function addUserWord(kind: UserWordRecord["kind"], word: string, replacement: string | null): Promise<void> {
  const w = word.trim();
  if (!w) return;
  if ((await listUserWords()).some((x) => x.kind === kind && x.word === w)) return;
  await (await getDb()).put("userWords", { id: uid(), kind, word: w, replacement: replacement?.trim() || null, createdAt: now() });
  notify("userWords");
}

export async function deleteUserWord(id: string): Promise<void> {
  await (await getDb()).delete("userWords", id);
  notify("userWords");
}

// ---------- Content Memory ----------

export async function listMemory(kind?: MemoryItemRecord["kind"]): Promise<MemoryItemRecord[]> {
  const all = await (await getDb()).getAll("memoryItems");
  return all.filter((m) => !kind || m.kind === kind).sort((a, b) => b.useCount - a.useCount || b.createdAt.localeCompare(a.createdAt));
}

export async function addMemory(kind: MemoryItemRecord["kind"], title: string, detail = ""): Promise<void> {
  const t = title.trim();
  if (!t) return;
  if ((await listMemory(kind)).some((m) => m.title === t)) return;
  await (await getDb()).put("memoryItems", { id: uid(), kind, title: t, detail: detail.trim(), useCount: 0, lastUsedAt: null, createdAt: now() });
  notify("memoryItems");
}

export async function updateMemory(id: string, patch: Partial<MemoryItemRecord>): Promise<void> {
  const db = await getDb();
  const current = await db.get("memoryItems", id);
  if (!current) return;
  await db.put("memoryItems", { ...current, ...patch });
  notify("memoryItems");
}

export async function deleteMemory(id: string): Promise<void> {
  await (await getDb()).delete("memoryItems", id);
  notify("memoryItems");
}

// 생성에 쓴 메모리 항목의 사용 횟수를 올린다 (자주 쓰는 순서로 정렬)
export async function markMemoryUsed(ids: string[]): Promise<void> {
  for (const id of ids) {
    const db = await getDb();
    const m = await db.get("memoryItems", id);
    if (m) await db.put("memoryItems", { ...m, useCount: m.useCount + 1, lastUsedAt: now() });
  }
  if (ids.length) notify("memoryItems");
}

// ---------- 프로젝트별 개인화 정보 ----------

export interface ProjectPersonalization {
  personalization: Personalization;
  brand: BrandProfileRecord | null;
  products: MemoryItemRecord[];
}

export async function loadPersonalization(p: ProjectRecord): Promise<ProjectPersonalization> {
  const [voice, brands, words, memory] = await Promise.all([getVoiceProfile(), listBrands(), listUserWords(), listMemory()]);
  const brand = (p.brandId && brands.find((b) => b.id === p.brandId)) || null;
  const cta = (p.ctaId && memory.find((m) => m.id === p.ctaId && m.kind === "cta")) || null;
  const products = memory.filter((m) => m.kind === "product" && p.productIds.includes(m.id));
  const userWords: UserWord[] = [
    ...words.filter((w) => w.kind === "forbidden").map((w) => ({ word: w.word, replacement: w.replacement })),
    ...(brand?.forbiddenWords ?? []),
  ];
  return {
    brand,
    products,
    personalization: {
      voice: p.useVoice && voice ? voice.features : null,
      brand: brand
        ? { name: brand.name, description: brand.description, products: brand.products, targetCustomer: brand.targetCustomer, keyMessage: brand.keyMessage, toneAndManner: brand.toneAndManner }
        : null,
      preferredPhrases: Array.from(new Set([...words.filter((w) => w.kind === "preferred").map((w) => w.word), ...(brand?.preferredPhrases ?? [])])),
      userWords,
      cta: cta?.title ?? null,
    },
  };
}
