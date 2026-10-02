import { ArrowRight, Copy, FolderDown, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { CATEGORIES, labelOf } from "@postory/shared";
import { backupFileName, exportBackup } from "../lib/backup";
import { downloadBlob } from "../lib/export";
import { deleteProject, duplicateProject } from "../lib/repo";
import type { ImageRecord, ProjectRecord } from "../lib/types";
import { PhotoThumb } from "./PhotoThumb";
import { PlatformTag, relativeTime, StatusChip, useToast } from "./ui";

export function projectLink(p: ProjectRecord): string {
  if (p.status !== "draft") return `/projects/${p.id}/editor`;
  return Object.keys(p.stages).length ? `/projects/${p.id}/processing?phase=${p.stages.compose_story ? "generate" : "analyze"}` : `/projects/${p.id}/setup`;
}

export function ProjectCard({ project, cover, actions }: { project: ProjectRecord; cover: ImageRecord | undefined; actions?: boolean }) {
  const toast = useToast();
  const navigate = useNavigate();
  const summary = project.masterStory?.keyMessage ?? project.quickText;
  return (
    <article className="group flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface transition-shadow hover:shadow-[var(--shadow-float)]">
      <Link to={projectLink(project)} className="relative block">
        <PhotoThumb image={cover} className="aspect-[16/11] w-full" alt="" />
        <StatusChip status={project.status} className="absolute left-3 top-3 bg-white/95" />
        {project.category && <span className="absolute bottom-3 left-3 rounded-md bg-ink/75 px-2 py-0.5 text-xs text-white">{labelOf(CATEGORIES, project.category)}</span>}
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <Link to={projectLink(project)} className="line-clamp-1 text-[17px] font-semibold text-ink hover:underline">
          {project.title}
        </Link>
        {summary && <p className="mt-1 line-clamp-2 text-sm text-muted">{summary}</p>}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {project.platforms.map((p) => (
            <PlatformTag key={p} platform={p} />
          ))}
        </div>
        <div className="mt-auto flex items-center gap-1 pt-4 text-xs text-muted">
          <span className="flex-1">{relativeTime(project.updatedAt)} 업데이트</span>
          {actions && (
            <>
              <button
                className="grid size-9 place-items-center rounded-lg hover:bg-subtle"
                aria-label="복제"
                title="복제"
                onClick={async () => {
                  const copy = await duplicateProject(project.id);
                  toast("입력값과 사진을 복제했습니다.", "success");
                  navigate(`/projects/${copy.id}/setup`);
                }}
              >
                <Copy className="size-4" />
              </button>
              <button
                className="grid size-9 place-items-center rounded-lg hover:bg-subtle"
                aria-label="내보내기"
                title="내보내기 (백업 파일)"
                onClick={async () => {
                  const { blob } = await exportBackup(project.id);
                  downloadBlob(blob, backupFileName("project", project.title));
                  toast("프로젝트를 백업 파일로 내보냈습니다. 설정 → 백업 불러오기로 되살릴 수 있어요.", "success");
                }}
              >
                <FolderDown className="size-4" />
              </button>
              <button
                className="grid size-9 place-items-center rounded-lg hover:bg-alert-soft hover:text-alert"
                aria-label="삭제"
                title="삭제"
                onClick={async () => {
                  if (!window.confirm(`'${project.title}'을(를) 삭제할까요? 사진과 모든 버전이 함께 삭제되며 되돌릴 수 없습니다.`)) return;
                  await deleteProject(project.id);
                  toast("삭제했습니다.");
                }}
              >
                <Trash2 className="size-4" />
              </button>
            </>
          )}
          <Link to={projectLink(project)} className="grid size-9 place-items-center rounded-lg hover:bg-subtle" aria-label="열기">
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </article>
  );
}
