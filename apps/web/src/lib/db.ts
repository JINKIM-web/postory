import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type {
  BrandProfileRecord,
  MemoryItemRecord,
  UserWordRecord,
  VoiceProfileRecord,
  ContentRecord,
  EventRecord,
  EvidenceRecord,
  ImageRecord,
  IssueRecord,
  ProjectRecord,
  QuestionRecord,
  UsageRecord,
  VersionRecord,
} from "./types";

// 로컬 MVP 저장소: 모든 프로젝트 데이터와 사진(Blob)은 이 브라우저의 IndexedDB에만 저장된다.

interface PostoryDB extends DBSchema {
  projects: { key: string; value: ProjectRecord; indexes: { byUpdated: string } };
  images: { key: string; value: ImageRecord; indexes: { byProject: string } };
  evidence: { key: string; value: EvidenceRecord; indexes: { byProject: string } };
  questions: { key: string; value: QuestionRecord; indexes: { byProject: string } };
  contents: { key: string; value: ContentRecord; indexes: { byProject: string } };
  versions: { key: string; value: VersionRecord; indexes: { byContent: string; byProject: string } };
  issues: { key: string; value: IssueRecord; indexes: { byContent: string; byProject: string } };
  events: { key: string; value: EventRecord; indexes: { byProject: string; byCreated: string } };
  usage: { key: string; value: UsageRecord; indexes: { byProject: string; byCreated: string } };
  voiceProfiles: { key: string; value: VoiceProfileRecord };
  brandProfiles: { key: string; value: BrandProfileRecord };
  userWords: { key: string; value: UserWordRecord };
  memoryItems: { key: string; value: MemoryItemRecord };
}

export type StoreName =
  | "projects"
  | "images"
  | "evidence"
  | "questions"
  | "contents"
  | "versions"
  | "issues"
  | "events"
  | "usage"
  | "voiceProfiles"
  | "brandProfiles"
  | "userWords"
  | "memoryItems";

export const PROFILE_STORES = ["voiceProfiles", "brandProfiles", "userWords", "memoryItems"] as const;

export const PROJECT_CHILD_STORES = ["images", "evidence", "questions", "contents", "versions", "issues", "events", "usage"] as const;

let dbPromise: Promise<IDBPDatabase<PostoryDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<PostoryDB>> {
  dbPromise ??= openDB<PostoryDB>("postory", 2, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) createV1(db);
      // v2: Phase 2A 개인화
      if (oldVersion < 2) for (const s of PROFILE_STORES) db.createObjectStore(s, { keyPath: "id" });
    },
  });
  return dbPromise;
}

function createV1(db: IDBPDatabase<PostoryDB>) {
  db.createObjectStore("projects", { keyPath: "id" }).createIndex("byUpdated", "updatedAt");
  db.createObjectStore("images", { keyPath: "id" }).createIndex("byProject", "projectId");
  db.createObjectStore("evidence", { keyPath: "id" }).createIndex("byProject", "projectId");
  db.createObjectStore("questions", { keyPath: "id" }).createIndex("byProject", "projectId");
  db.createObjectStore("contents", { keyPath: "id" }).createIndex("byProject", "projectId");
  const versions = db.createObjectStore("versions", { keyPath: "id" });
  versions.createIndex("byContent", "contentId");
  versions.createIndex("byProject", "projectId");
  const issues = db.createObjectStore("issues", { keyPath: "id" });
  issues.createIndex("byContent", "contentId");
  issues.createIndex("byProject", "projectId");
  const events = db.createObjectStore("events", { keyPath: "id" });
  events.createIndex("byProject", "projectId");
  events.createIndex("byCreated", "createdAt");
  const usage = db.createObjectStore("usage", { keyPath: "id" });
  usage.createIndex("byProject", "projectId");
  usage.createIndex("byCreated", "createdAt");
}

// 변경 알림 — 화면이 IndexedDB 변경을 구독해 다시 읽는다
type Listener = (stores: StoreName[]) => void;
const listeners = new Set<Listener>();

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notify(...stores: StoreName[]): void {
  for (const l of listeners) l(stores);
}

export const now = () => new Date().toISOString();
export const uid = () => crypto.randomUUID();
