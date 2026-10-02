import { CircleCheck, Copy, Download, FileDown, PanelRight, PencilLine, RefreshCw, Send, TriangleAlert, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import type { BlogContent, FacebookContent, InstagramContent, Platform, ShortsContent } from "@postory/shared";
import { Button, cx, Notice, PLATFORM_KO, PlatformIcon, Spinner, StatusChip, useToast } from "../../components/ui";
import { coverCredit } from "@postory/quality";
import { effectiveCover, renderCover } from "../../lib/cover";
import { buildImageZip, blogRichHtml, copyPlain, copyRich, downloadBlob, editRatio, plainFor } from "../../lib/export";
import { useLive } from "../../lib/hooks";
import { regenerateChannel } from "../../lib/pipeline";
import { getProject, getVersion, listContents, listImages, listIssues, logEvent, updateProject } from "../../lib/repo";
import { setSettings, useSettings } from "../../lib/settings";
import type { ContentRecord } from "../../lib/types";
import { checkRewriteAllowed } from "../../lib/usage";
import { BlogStudio } from "./BlogStudio";
import { CopyDialog, type CopyChoice } from "./CopyDialog";
import { EvidencePanel, QualityPanel, VersionsPanel } from "./Panels";
import { ShortsView } from "./ShortsView";
import { FacebookView, InstagramView } from "./SocialViews";
import { useChannelDraft } from "./useChannel";

const PANEL_TABS = [
  { key: "quality", label: "품질 검토" },
  { key: "evidence", label: "근거 분석" },
  { key: "versions", label: "버전 기록" },
] as const;

export function EditorPage() {
  const { id = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const settings = useSettings();
  const [panelOpen, setPanelOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [regenerating, setRegenerating] = useState<Platform | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);

  const { data } = useLive(
    async () => ({ project: await getProject(id), images: await listImages(id), contents: await listContents(id) }),
    [id],
    ["projects", "images", "contents"],
  );
  const project = data?.project;
  const platforms = project?.platforms ?? [];
  const active = (platforms.includes(params.get("ch") as Platform) ? params.get("ch") : platforms[0]) as Platform | undefined;
  const content = data?.contents.find((c) => c.platform === active);
  const channel = useChannelDraft(content?.state === "ok" ? content : undefined);
  const { data: issues = [] } = useLive(() => (content ? listIssues(content.id) : Promise.resolve([])), [content?.id], ["issues"]);
  const images = data?.images ?? [];
  const zipSkipped = useMemo(() => images.filter((i) => !i.stored).length, [images]);

  // 품질 검토 결과를 열어보면 Reviewed (명세서 19.2)
  useEffect(() => {
    if (project?.status === "generated" && settings.rightPanelTab === "quality" && content?.state === "ok") void updateProject(project.id, { status: "reviewed" });
  }, [project?.status, project?.id, settings.rightPanelTab, content?.state]);

  if (!data) return <Spinner className="mx-auto mt-20" />;
  if (!project) return <Notice tone="alert">프로젝트를 찾을 수 없습니다.</Notice>;
  if (!data.contents.length) {
    return (
      <Notice tone="warning" title="아직 생성된 콘텐츠가 없습니다">
        <Link to={`/projects/${id}/setup`} className="underline">
          입력 화면
        </Link>
        에서 스토리를 만들어 주세요.
      </Notice>
    );
  }

  async function logCopy(c: ContentRecord, kind: "copy_rich" | "copy_plain") {
    const final = await getVersion(c.aiFinalVersionId);
    const ratio = final && channel.draft ? editRatio(final.data, channel.draft) : null;
    await logEvent(project!.id, kind, { contentId: c.id, versionId: c.currentVersionId, payload: { platform: c.platform, editRatio: ratio } });
  }

  async function copyChannel() {
    if (!content || !channel.draft) return;
    if (content.platform === "blog") return setCopyOpen(true);
    try {
      channel.flush();
      await copyPlain(plainFor(channel.draft));
      await logCopy(content, "copy_plain");
      toast(content.platform === "shorts" ? "스크립트를 복사했습니다." : "복사했습니다. 붙여넣어 게시하세요.", "success");
    } catch {
      toast("클립보드에 복사하지 못했습니다. 브라우저 권한을 확인하세요.", "alert");
    }
  }

  async function copyBlog(choice: CopyChoice) {
    if (!content || channel.draft?.platform !== "blog") return;
    const blog = channel.draft;
    const plain = plainFor(blog, choice.includeTitle);
    try {
      channel.flush();
      if (choice.format === "rich") await copyRich(blogRichHtml(blog, choice), plain);
      else await copyPlain(plain);
      await logCopy(content, choice.format === "rich" ? "copy_rich" : "copy_plain");
      toast("복사했습니다. 네이버 스마트에디터에 붙여넣으세요.", "success");
      setCopyOpen(false);
    } catch {
      toast("클립보드에 복사하지 못했습니다. HTTPS 또는 localhost에서 실행 중인지 확인하세요.", "alert");
    }
  }

  async function downloadZip() {
    // 블로그 대표 카드가 켜져 있으면 00번으로 함께 넣는다
    const blogContent = data!.contents.find((c) => c.platform === "blog" && c.state === "ok");
    const blog = channel.draft?.platform === "blog" ? channel.draft : (await getVersion(blogContent?.currentVersionId ?? null))?.data;
    let cover: { blob: Blob; credit: string | null } | undefined;
    if (blog?.platform === "blog") {
      const c = effectiveCover(blog, images);
      if (c.enabled) cover = { blob: await renderCover(c, blog.title, images), credit: coverCredit(c) || null };
    }
    const { blob, count } = await buildImageZip(images, cover);
    if (!count) return toast("내려받을 수 있는 사진이 없습니다.", "alert");
    downloadBlob(blob, `${project!.title.slice(0, 30) || "postory"}_사진.zip`);
    await logEvent(project!.id, "download_zip", { contentId: content?.id ?? null, payload: { count } });
  }

  async function downloadText() {
    if (!content || !channel.draft) return;
    channel.flush();
    downloadBlob(new Blob([plainFor(channel.draft)], { type: "text/plain;charset=utf-8" }), `${project!.title.slice(0, 30)}_${PLATFORM_KO[content.platform]}.txt`);
    await logEvent(project!.id, "download_text", { contentId: content.id, versionId: content.currentVersionId, payload: { platform: content.platform } });
  }

  async function regenerate(platform: Platform) {
    const limit = await checkRewriteAllowed();
    if (limit) return toast(limit, "alert");
    if (content?.state === "ok" && !window.confirm(`${PLATFORM_KO[platform]} 콘텐츠를 새로 생성할까요? 지금 버전은 버전 기록에 남습니다.`)) return;
    setRegenerating(platform);
    try {
      await regenerateChannel(project!.id, platform);
      toast(`${PLATFORM_KO[platform]} 콘텐츠를 새로 만들었습니다.`, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "생성에 실패했습니다.", "alert");
    } finally {
      setRegenerating(null);
    }
  }

  const panel = (
    <div>
      <div className="mb-4 flex gap-1 rounded-[10px] bg-subtle p-1" role="tablist">
        {PANEL_TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={settings.rightPanelTab === t.key}
            onClick={() => setSettings({ rightPanelTab: t.key })}
            className={cx("h-9 flex-1 rounded-lg text-[13px] font-medium", settings.rightPanelTab === t.key ? "bg-surface text-ink shadow-sm" : "text-muted")}
          >
            {t.label}
          </button>
        ))}
      </div>
      {content?.state === "ok" && settings.rightPanelTab === "quality" && <QualityPanel project={project} content={content} issues={issues} channel={channel} />}
      {settings.rightPanelTab === "evidence" && <EvidencePanel project={project} />}
      {content?.state === "ok" && settings.rightPanelTab === "versions" && <VersionsPanel content={content} />}
    </div>
  );

  return (
    <div className="mx-auto max-w-[1440px]">
      {/* 헤더 */}
      <div className="mb-5 flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          {editingTitle ? (
            <input
              autoFocus
              defaultValue={project.title}
              onBlur={(e) => {
                setEditingTitle(false);
                const title = e.target.value.trim();
                if (title && title !== project.title) void updateProject(project.id, { title, titleEdited: true });
              }}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              className="w-full rounded-lg border border-accent bg-surface px-2 py-1 text-2xl font-bold text-ink outline-none"
              aria-label="프로젝트 이름"
            />
          ) : (
            <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-[28px]">
              <span className="truncate">{project.title}</span>
              <button className="grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-subtle" onClick={() => setEditingTitle(true)} aria-label="프로젝트 이름 수정">
                <PencilLine className="size-4" />
              </button>
            </h1>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
            <StatusChip status={project.status} />
            <Link to={`/projects/${project.id}/setup`} className="underline-offset-2 hover:underline">
              입력 수정
            </Link>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {project.status !== "published" && project.status !== "ready" && (
            <Button size="sm" icon={<CircleCheck className="size-4" />} onClick={() => updateProject(project.id, { status: "ready" })}>
              게시 준비 완료
            </Button>
          )}
          {project.status !== "published" ? (
            <Button
              size="sm"
              icon={<Send className="size-4" />}
              onClick={async () => {
                await updateProject(project.id, { status: "published", publishedMarkedAt: new Date().toISOString() });
                await logEvent(project.id, "mark_published", { payload: { platforms: project.platforms } });
                toast("게시 완료로 표시했습니다.", "success");
              }}
            >
              게시 완료 표시
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => updateProject(project.id, { status: "ready", publishedMarkedAt: null })}>
              게시 완료 취소
            </Button>
          )}
          <Button size="sm" icon={<Download className="size-4" />} onClick={downloadZip} disabled={!images.length}>
            이미지 ZIP
          </Button>
          <Button size="sm" variant="ghost" icon={<FileDown className="size-4" />} onClick={downloadText} disabled={!channel.draft}>
            .txt
          </Button>
          <Button size="sm" variant="primary" icon={<Copy className="size-4" />} onClick={copyChannel} disabled={!channel.draft}>
            {active === "blog" ? "네이버 블로그용 복사" : active === "shorts" ? "스크립트 복사" : "복사"}
          </Button>
        </div>
      </div>

      {project.faceWarning && (
        <Notice tone="warning" icon={<TriangleAlert className="size-4" />} className="mb-4" title="사진에 사람 얼굴 등 타인이 식별될 수 있는 요소가 있습니다">
          게시 전에 초상권과 개인정보 노출을 확인하세요.
        </Notice>
      )}

      <div className="grid gap-5 xl:grid-cols-[200px_minmax(0,1fr)_340px]">
        {/* 채널 탭 */}
        <nav aria-label="채널" className="-mx-4 flex gap-2 overflow-x-auto px-4 xl:mx-0 xl:flex-col xl:overflow-visible xl:px-0">
          <p className="hidden px-1 text-xs font-semibold text-muted xl:block">One Story → {platforms.length}채널</p>
          {platforms.map((p) => {
            const c = data.contents.find((x) => x.platform === p);
            const isActive = p === active;
            return (
              <button
                key={p}
                onClick={() => setParams({ ch: p }, { replace: true })}
                className={cx(
                  "flex min-h-11 shrink-0 items-center gap-2.5 rounded-[10px] border px-3 py-2 text-left text-sm transition-colors",
                  isActive ? "border-accent bg-accent-tint font-semibold text-accent-text" : "border-line bg-surface text-ink-2 hover:border-line-strong",
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <PlatformIcon platform={p} />
                <span className="flex-1">{PLATFORM_KO[p]}</span>
                <span
                  className={cx("size-2 rounded-full", !c ? "bg-line-strong" : c.state === "failed" ? "bg-alert" : c.reviewError ? "bg-unknown" : "bg-confirmed")}
                  aria-label={!c ? "생성 전" : c.state === "failed" ? "생성 실패" : c.reviewError ? "검토 필요" : "준비됨"}
                />
              </button>
            );
          })}
          {active && content?.state === "ok" && (
            <Button size="sm" variant="ghost" className="shrink-0 xl:mt-2" loading={regenerating === active} icon={<RefreshCw className="size-4" />} onClick={() => regenerate(active)}>
              이 채널 다시 생성
            </Button>
          )}
        </nav>

        {/* 본문 */}
        <div className="min-w-0">
          {!content || content.state === "failed" ? (
            <Notice tone="alert" icon={<TriangleAlert className="size-4" />} title={`${active ? PLATFORM_KO[active] : ""} 콘텐츠를 만들지 못했습니다`}>
              <p>{content?.error ?? "아직 생성되지 않았습니다."} 다른 채널 결과는 안전하게 저장되어 있습니다.</p>
              {active && (
                <Button size="sm" className="mt-3" loading={regenerating === active} icon={<RefreshCw className="size-4" />} onClick={() => regenerate(active)}>
                  {PLATFORM_KO[active]}만 다시 생성
                </Button>
              )}
            </Notice>
          ) : !channel.draft ? (
            <Spinner className="mx-auto mt-10" />
          ) : channel.draft.platform === "blog" ? (
            <BlogStudio key={content.id} project={project} content={content} images={images} channel={channel as never} />
          ) : channel.draft.platform === "facebook" ? (
            <FacebookView project={project} content={content} images={images} channel={channel as ReturnType<typeof useChannelDraft<FacebookContent>>} />
          ) : channel.draft.platform === "instagram" ? (
            <InstagramView project={project} content={content} images={images} channel={channel as ReturnType<typeof useChannelDraft<InstagramContent>>} />
          ) : (
            <ShortsView images={images} channel={channel as ReturnType<typeof useChannelDraft<ShortsContent>>} />
          )}
        </div>

        {/* 우측 패널: 데스크톱 고정, 작은 화면은 서랍 */}
        <aside className="hidden xl:block">
          <div className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-[var(--radius-card)] border border-line bg-surface p-4">{panel}</div>
        </aside>
      </div>

      <button
        className="fixed bottom-5 right-5 z-30 inline-flex h-12 items-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-white shadow-[var(--shadow-overlay)] xl:hidden"
        onClick={() => setPanelOpen(true)}
      >
        <PanelRight className="size-4" /> 품질·근거 보기
        {issues.filter((i) => i.status === "open").length > 0 && <span className="rounded-full bg-accent px-2 text-xs">{issues.filter((i) => i.status === "open").length}</span>}
      </button>
      {panelOpen && (
        <div className="fixed inset-0 z-40 xl:hidden">
          <div className="absolute inset-0 bg-[rgba(23,23,23,0.35)]" onClick={() => setPanelOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-[18px] bg-surface p-4 sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[380px] sm:rounded-none">
            <div className="mb-2 flex justify-end">
              <button className="grid size-10 place-items-center rounded-lg text-muted" onClick={() => setPanelOpen(false)} aria-label="닫기">
                <X className="size-5" />
              </button>
            </div>
            {panel}
          </div>
        </div>
      )}

      {channel.draft?.platform === "blog" && (
        <CopyDialog open={copyOpen} onClose={() => setCopyOpen(false)} content={channel.draft as BlogContent} onCopy={copyBlog} onZip={downloadZip} photoCount={images.length} zipSkipped={zipSkipped} />
      )}
      <div className="sr-only" aria-live="polite">
        {regenerating && `${PLATFORM_KO[regenerating]} 생성 중`}
      </div>
    </div>
  );
}
