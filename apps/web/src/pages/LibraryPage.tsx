import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { CATEGORIES, PLATFORMS, PROJECT_STATUSES } from "@postory/shared";
import { ProjectCard } from "../components/ProjectCard";
import { EmptyState, Spinner } from "../components/ui";
import { useLive } from "../lib/hooks";
import { listImages, listProjects } from "../lib/repo";

// 콘텐츠 라이브러리 (명세서 36장 6, 벤치마크 22장)

const select = "h-11 rounded-[10px] border border-line bg-surface px-3 text-sm outline-none focus:border-accent";

export function LibraryPage() {
  const { data } = useLive(
    async () => {
      const projects = await listProjects();
      const covers = new Map(await Promise.all(projects.map(async (p) => [p.id, (await listImages(p.id))[0]] as const)));
      return { projects, covers };
    },
    [],
    ["projects", "images"],
  );
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [platform, setPlatform] = useState("");
  const [status, setStatus] = useState("");
  const [period, setPeriod] = useState("");

  const filtered = useMemo(() => {
    if (!data) return [];
    const since = period ? Date.now() - Number(period) * 86_400_000 : 0;
    const needle = q.trim().toLowerCase();
    return data.projects.filter(
      (p) =>
        (!needle || `${p.title} ${p.quickText}`.toLowerCase().includes(needle)) &&
        (!category || p.category === category) &&
        (!platform || p.platforms.includes(platform as never)) &&
        (!status || p.status === status) &&
        (!since || new Date(p.updatedAt).getTime() >= since),
    );
  }, [data, q, category, platform, status, period]);

  return (
    <div className="mx-auto max-w-[1280px]">
      <h1 className="text-[28px] font-bold">콘텐츠 라이브러리</h1>
      <p className="mt-1 text-muted">이 브라우저에 저장된 프로젝트입니다.</p>

      <div className="mt-6 flex flex-wrap gap-2">
        <label className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="제목·메모 검색" className={`${select} w-full pl-9`} aria-label="검색" />
        </label>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={select} aria-label="카테고리">
          <option value="">모든 카테고리</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <select value={platform} onChange={(e) => setPlatform(e.target.value)} className={select} aria-label="채널">
          <option value="">모든 채널</option>
          {PLATFORMS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={select} aria-label="상태">
          <option value="">모든 상태</option>
          {PROJECT_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <select value={period} onChange={(e) => setPeriod(e.target.value)} className={select} aria-label="기간">
          <option value="">전체 기간</option>
          <option value="7">최근 7일</option>
          <option value="30">최근 30일</option>
          <option value="90">최근 90일</option>
        </select>
      </div>

      <div className="mt-6">
        {!data ? (
          <Spinner className="mx-auto" />
        ) : data.projects.length === 0 ? (
          <EmptyState title="저장된 프로젝트가 없습니다." body="새 스토리를 만들면 여기에 모입니다." />
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-muted">조건에 맞는 프로젝트가 없습니다.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {filtered.map((p) => (
              <ProjectCard key={p.id} project={p} cover={data.covers.get(p.id)} actions />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
