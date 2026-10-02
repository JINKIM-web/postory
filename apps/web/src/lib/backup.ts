import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { getDb, notify, PROFILE_STORES, PROJECT_CHILD_STORES, type StoreName } from "./db";
import { getSettings, setSettings, type Settings } from "./settings";

// 백업·복원 — 로컬 MVP의 데이터는 이 브라우저의 IndexedDB에만 있으므로 파일로 내보내고 다시 불러온다.
// 형식: ZIP 안에 manifest.json + data.json(레코드) + blobs/(사진 원본·분석본·썸네일)

const FORMAT = 1;
const ALL_STORES: StoreName[] = ["projects", ...PROJECT_CHILD_STORES, ...PROFILE_STORES];

interface Manifest {
  app: "postory";
  format: number;
  scope: "all" | "project";
  exportedAt: string;
  counts: Partial<Record<StoreName, number>>;
  settings?: Settings;
}

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
interface BlobRef {
  $blob: string;
  type: string;
}

const isBlobRef = (v: unknown): v is BlobRef => !!v && typeof v === "object" && typeof (v as BlobRef).$blob === "string";

export class BackupError extends Error {}

async function encode(value: unknown, path: string, files: Record<string, Uint8Array>): Promise<Json> {
  if (value instanceof Blob) {
    const ext = value.type === "image/png" ? "png" : value.type === "image/webp" ? "webp" : "jpg";
    const name = `blobs/${path}.${ext}`;
    files[name] = new Uint8Array(await value.arrayBuffer());
    return { $blob: name, type: value.type } satisfies BlobRef as unknown as Json;
  }
  if (Array.isArray(value)) return Promise.all(value.map((v, i) => encode(v, `${path}_${i}`, files)));
  if (value && typeof value === "object") {
    const out: Record<string, Json> = {};
    for (const [k, v] of Object.entries(value)) out[k] = await encode(v, `${path}_${k}`, files);
    return out;
  }
  return (value ?? null) as Json;
}

function decode(value: Json, files: Record<string, Uint8Array>): unknown {
  if (isBlobRef(value)) {
    const bytes = files[value.$blob];
    if (!bytes) throw new BackupError(`백업 파일에 사진이 빠져 있습니다: ${value.$blob}`);
    return new Blob([bytes as BlobPart], { type: value.type });
  }
  if (Array.isArray(value)) return value.map((v) => decode(v, files));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, decode(v, files)]));
  return value;
}

// projectId가 있으면 그 프로젝트와 딸린 데이터만, 없으면 전체(개인화·설정 포함)
export async function exportBackup(projectId?: string): Promise<{ blob: Blob; manifest: Manifest }> {
  const db = await getDb();
  const files: Record<string, Uint8Array> = {};
  const data: Partial<Record<StoreName, Json[]>> = {};
  const counts: Partial<Record<StoreName, number>> = {};

  const stores: StoreName[] = projectId ? ["projects", ...PROJECT_CHILD_STORES] : ALL_STORES;
  for (const store of stores) {
    let records: { id: string; projectId?: string }[] = await db.getAll(store);
    if (projectId) records = records.filter((r) => (store === "projects" ? r.id === projectId : r.projectId === projectId));
    data[store] = await Promise.all(records.map((r) => encode(r, `${store}/${r.id}`, files)));
    counts[store] = records.length;
  }
  if (projectId && !counts.projects) throw new BackupError("프로젝트를 찾을 수 없습니다.");

  const manifest: Manifest = {
    app: "postory",
    format: FORMAT,
    scope: projectId ? "project" : "all",
    exportedAt: new Date().toISOString(),
    counts,
    ...(projectId ? {} : { settings: getSettings() }),
  };
  files["manifest.json"] = strToU8(JSON.stringify(manifest, null, 2));
  files["data.json"] = strToU8(JSON.stringify(data));
  // 사진은 이미 JPEG라 압축하지 않는다
  const zipped = zipSync(files, { level: 0 });
  if (!projectId) setSettings({ lastBackupAt: manifest.exportedAt });
  return { blob: new Blob([zipped as BlobPart], { type: "application/zip" }), manifest };
}

export async function readBackup(file: Blob): Promise<{ manifest: Manifest; data: Partial<Record<StoreName, unknown[]>> }> {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(new Uint8Array(await file.arrayBuffer()));
  } catch {
    throw new BackupError("ZIP 파일을 열 수 없습니다.");
  }
  if (!files["manifest.json"] || !files["data.json"]) throw new BackupError("POSTORY 백업 파일이 아닙니다.");
  const manifest = JSON.parse(strFromU8(files["manifest.json"])) as Manifest;
  if (manifest.app !== "postory") throw new BackupError("POSTORY 백업 파일이 아닙니다.");
  if (manifest.format > FORMAT) throw new BackupError("더 새로운 버전에서 만든 백업입니다. 앱을 업데이트한 뒤 불러오세요.");
  const raw = JSON.parse(strFromU8(files["data.json"])) as Partial<Record<StoreName, Json[]>>;
  const data: Partial<Record<StoreName, unknown[]>> = {};
  for (const store of ALL_STORES) if (raw[store]) data[store] = raw[store]!.map((r) => decode(r, files));
  return { manifest, data };
}

// merge: 같은 ID는 백업 내용으로 덮어쓰고 나머지는 유지 / replace: 모두 지우고 백업으로 바꾼다
export async function importBackup(file: Blob, mode: "merge" | "replace"): Promise<{ manifest: Manifest; imported: number }> {
  const { manifest, data } = await readBackup(file);
  const db = await getDb();
  const tx = db.transaction(ALL_STORES, "readwrite");
  if (mode === "replace") await Promise.all(ALL_STORES.map((s) => tx.objectStore(s).clear()));
  let imported = 0;
  for (const store of ALL_STORES) {
    for (const record of data[store] ?? []) {
      await tx.objectStore(store).put(record as never);
      imported++;
    }
  }
  await tx.done;
  if (manifest.settings && mode === "replace") setSettings({ ...manifest.settings, lastBackupAt: getSettings().lastBackupAt });
  notify(...ALL_STORES);
  return { manifest, imported };
}

export function backupFileName(scope: "all" | "project", title?: string): string {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const safe = (title ?? "").replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "_").slice(0, 30);
  return scope === "all" ? `postory-백업-${stamp}.zip` : `postory-${safe || "프로젝트"}-${stamp}.zip`;
}
