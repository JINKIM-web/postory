import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { backupFileName, exportBackup, importBackup, readBackup } from "./backup";
import { getDb, now, uid } from "./db";
import { addMemory, listMemory } from "./profiles";
import { clearAllData, createProject, listImages, listProjects, putImage } from "./repo";
import type { ImageRecord } from "./types";

function image(projectId: string, bytes: number[]): ImageRecord {
  const blob = new Blob([new Uint8Array(bytes)], { type: "image/jpeg" });
  return {
    id: uid(),
    projectId,
    sortOrder: 0,
    source: "user",
    caption: "라떼",
    captionEdited: true,
    takenAt: null,
    stored: blob,
    analysis: blob,
    thumb: blob,
    externalUrl: null,
    externalThumbUrl: null,
    width: 10,
    height: 10,
    attribution: null,
    visualFacts: [{ text: "라떼 한 잔", confidence: "high" }],
    hasPeople: false,
    createdAt: now(),
  };
}

describe("백업·복원", () => {
  it("전체 백업 → 전체 삭제 → 교체 복원하면 프로젝트·사진·개인화가 돌아온다", async () => {
    const p = await createProject({ title: "성수동 카페", quickText: "라떼를 마셨다" });
    await putImage(image(p.id, [1, 2, 3, 4]));
    await addMemory("cta", "주말에 들러 보세요.");

    const { blob, manifest } = await exportBackup();
    expect(manifest.scope).toBe("all");
    expect(manifest.counts.images).toBe(1);

    await clearAllData();
    expect(await listProjects()).toHaveLength(0);

    const { imported } = await importBackup(blob, "replace");
    expect(imported).toBeGreaterThanOrEqual(3);
    const [restored] = await listProjects();
    expect(restored?.title).toBe("성수동 카페");
    const [img] = await listImages(p.id);
    expect(img?.stored).toBeInstanceOf(Blob);
    expect(Array.from(new Uint8Array(await img!.stored!.arrayBuffer()))).toEqual([1, 2, 3, 4]);
    expect(img?.visualFacts[0]?.text).toBe("라떼 한 잔");
    expect((await listMemory("cta"))[0]?.title).toBe("주말에 들러 보세요.");
  });

  it("프로젝트 하나만 내보내고 합치기로 불러오면 다른 데이터는 그대로다", async () => {
    await clearAllData();
    const a = await createProject({ title: "A" });
    const b = await createProject({ title: "B" });
    await putImage(image(a.id, [9]));
    const { blob, manifest } = await exportBackup(a.id);
    expect(manifest.scope).toBe("project");
    expect(manifest.counts.projects).toBe(1);
    expect(manifest.settings).toBeUndefined();

    const db = await getDb();
    await db.delete("projects", a.id);
    await importBackup(blob, "merge");
    const titles = (await listProjects()).map((p) => p.title).sort();
    expect(titles).toEqual(["A", "B"]);
    expect(b.id).toBeTruthy();
  });

  it("POSTORY 백업이 아니면 거절한다", async () => {
    await expect(readBackup(new Blob(["not a zip"]))).rejects.toThrow("ZIP");
  });

  it("파일 이름에 날짜와 제목을 넣는다", () => {
    expect(backupFileName("all")).toMatch(/^postory-백업-\d{8}\.zip$/);
    expect(backupFileName("project", "성수동: 카페")).toMatch(/^postory-성수동_카페-\d{8}\.zip$/);
  });
});
