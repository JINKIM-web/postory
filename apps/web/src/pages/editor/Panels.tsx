import { CircleCheck, CircleHelp, Eye, History, Image, Info, OctagonAlert, RefreshCw, RotateCcw, ShieldCheck, TriangleAlert, UserRound } from "lucide-react";
import { useState } from "react";
import { readinessScore, replaceSentence, summarizeGroups } from "@postory/quality";
import type { CheckType, ContentVersionOrigin } from "@postory/shared";
import { Button, cx, Notice, relativeTime, useToast } from "../../components/ui";
import { useLive } from "../../lib/hooks";
import { recheckChannel } from "../../lib/pipeline";
import { addVersion, listEvidence, listImages, listVersions, updateIssue } from "../../lib/repo";
import { useSettings } from "../../lib/settings";
import type { ContentRecord, IssueRecord, ProjectRecord } from "../../lib/types";
import type { ChannelDraft } from "./useChannel";

const CHECK_LABEL: Record<CheckType, string> = {
  forbidden: "금칙어",
  claim: "과장 표현",
  evidence: "사실 근거",
  keyword: "키워드 반복",
  generic_phrase: "AI 상투 표현",
  search: "검색 품질",
  tone: "선택 톤",
  length: "분량·형식",
  disclosure: "광고·협찬 표기",
};

function applicableChecks(platform: ContentRecord["platform"]): CheckType[] {
  const base: CheckType[] = ["evidence", "forbidden", "disclosure", "claim", "generic_phrase", "tone", "length"];
  if (platform === "blog") return [...base, "search", "keyword"];
  if (platform === "facebook") return [...base, "keyword"];
  return base;
}

// ---------- Quality ----------

export function QualityPanel({ project, content, issues, channel }: { project: ProjectRecord; content: ContentRecord; issues: IssueRecord[]; channel: ChannelDraft }) {
  const toast = useToast();
  const settings = useSettings();
  const [checking, setChecking] = useState(false);
  // My Voice·브랜드를 적용했으면 톤 항목 이름을 바꾼다 (명세서 14장 Phase 2)
  const toneLabelOverride = project.useVoice ? "My Voice 일치" : project.brandId ? "브랜드 톤 일치" : undefined;
  const groups = summarizeGroups(issues, applicableChecks(content.platform), toneLabelOverride ? { tone: toneLabelOverride } : {});
  const passed = groups.filter((g) => g.status === "pass").length;
  const open = issues.filter((i) => i.status === "open" || i.status === "reverted");
  const autoFixed = issues.filter((i) => i.status === "auto_fixed");
  const closed = issues.filter((i) => i.status === "accepted" || i.status === "ignored");
  const score = readinessScore(issues);

  async function apply(issue: IssueRecord) {
    if (!channel.draft || issue.suggestion === null) return;
    const next = replaceSentence(channel.draft, issue.originalText, issue.suggestion);
    if (!next) return toast("본문에서 해당 문장을 찾지 못했습니다. 이미 수정되었을 수 있어요.", "alert");
    await channel.commit(next, "issue_fix");
    await updateIssue(issue.id, { status: "accepted" });
  }

  async function revertAuto(issue: IssueRecord) {
    if (!channel.draft || !issue.suggestion) return;
    const next = replaceSentence(channel.draft, issue.suggestion, issue.originalText);
    if (!next) return toast("수정된 문장을 찾지 못했습니다. 버전 기록에서 되돌려 주세요.", "alert");
    await channel.commit(next, "issue_fix");
    await updateIssue(issue.id, { status: "reverted" });
  }

  async function recheck() {
    setChecking(true);
    try {
      channel.flush();
      await recheckChannel(project.id, content);
      toast("현재 내용으로 다시 검사했습니다.", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "검사에 실패했습니다.", "alert");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[10px] bg-confirmed-soft p-4">
        <p className="text-xs font-semibold tracking-wide text-confirmed">게시 준비 상태</p>
        {settings.showReadinessScore && (
          <p className="mt-1 text-3xl font-bold text-confirmed">
            {score}
            <span className="text-sm font-medium"> / 100</span>
          </p>
        )}
        <p className="mt-1 text-sm text-ink-2">
          {passed}개 항목 통과 · {groups.length - passed}개 개선 제안
        </p>
      </div>

      {content.reviewError && (
        <Notice tone="warning" icon={<TriangleAlert className="size-4" />} title="품질 검토를 완료하지 못했습니다">
          {content.reviewError}
        </Notice>
      )}

      <ul className="space-y-1.5">
        {groups.map((g) => (
          <li key={g.key} className="flex items-center gap-2.5 rounded-lg bg-canvas-alt px-3 py-2.5 text-sm">
            {g.status === "pass" ? (
              <CircleCheck className="size-4 text-confirmed" aria-hidden />
            ) : g.status === "warning" ? (
              <OctagonAlert className="size-4 text-alert" aria-hidden />
            ) : (
              <TriangleAlert className="size-4 text-unknown" aria-hidden />
            )}
            <span className="flex-1 text-ink">{g.label}</span>
            <span className={cx("text-xs font-medium", g.status === "pass" ? "text-confirmed" : g.status === "warning" ? "text-alert" : "text-unknown")}>
              {g.status === "pass" ? "통과" : g.status === "warning" ? `경고 ${g.openCount}` : `개선 ${g.openCount}`}
            </span>
          </li>
        ))}
      </ul>

      <Button size="sm" className="w-full" loading={checking} icon={<RefreshCw className="size-4" />} onClick={recheck}>
        현재 내용으로 다시 검사
      </Button>

      {open.length === 0 && autoFixed.length === 0 && <Notice tone="success" icon={<ShieldCheck className="size-4" />}>검토할 문제가 없습니다. 게시 준비가 완료되었습니다.</Notice>}

      {open.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">개선 제안 ({open.length})</h3>
          {open.map((issue) => (
            <IssueCard key={issue.id} issue={issue}>
              {issue.suggestion !== null && issue.originalText && (
                <Button size="sm" variant="primary" onClick={() => apply(issue)}>
                  {issue.suggestion === "" ? "문장 삭제" : "추천 수정 적용"}
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => updateIssue(issue.id, { status: "ignored" })}>
                무시하기
              </Button>
            </IssueCard>
          ))}
        </section>
      )}

      {autoFixed.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">자동 수정됨 ({autoFixed.length})</h3>
          {autoFixed.map((issue) => (
            <IssueCard key={issue.id} issue={issue} muted>
              {issue.suggestion && issue.originalText ? (
                <Button size="sm" variant="ghost" icon={<RotateCcw className="size-3.5" />} onClick={() => revertAuto(issue)}>
                  원문으로 되돌리기
                </Button>
              ) : (
                <span className="text-xs text-muted">{issue.checkType === "disclosure" ? "표기 문구를 넣었습니다" : "근거가 없어 문장을 삭제했습니다 · 버전 기록에서 되돌릴 수 있어요"}</span>
              )}
            </IssueCard>
          ))}
        </section>
      )}

      {closed.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer py-2 text-muted">처리한 항목 {closed.length}개</summary>
          <div className="space-y-2">
            {closed.map((issue) => (
              <IssueCard key={issue.id} issue={issue} muted>
                <span className="text-xs text-muted">{issue.status === "accepted" ? "수정 적용함" : "무시함"}</span>
                {issue.status === "ignored" && (
                  <Button size="sm" variant="ghost" onClick={() => updateIssue(issue.id, { status: "open" })}>
                    다시 보기
                  </Button>
                )}
              </IssueCard>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function IssueCard({ issue, children, muted }: { issue: IssueRecord; children?: React.ReactNode; muted?: boolean }) {
  const severe = issue.severity === "L1";
  return (
    <article className={cx("rounded-[10px] border p-3.5", muted ? "border-line bg-surface" : severe ? "border-red-200 bg-alert-soft/40" : "border-line bg-surface")}>
      <div className="flex items-center gap-1.5 text-[13px] font-semibold">
        {severe ? <OctagonAlert className="size-4 text-alert" aria-hidden /> : issue.severity === "info" ? <Info className="size-4 text-muted" aria-hidden /> : <TriangleAlert className="size-4 text-unknown" aria-hidden />}
        <span className={severe ? "text-alert" : "text-ink"}>{CHECK_LABEL[issue.checkType]}</span>
        <span className="ml-auto rounded bg-subtle px-1.5 py-0.5 text-[11px] font-medium text-muted">{issue.severity === "info" ? "참고" : issue.severity === "L4" ? "내 금칙어" : issue.severity}</span>
      </div>
      {issue.originalText && <p className="mt-2 border-l-2 border-line-strong pl-2.5 text-[13px] text-ink-2">“{issue.originalText}”</p>}
      <p className="mt-2 text-[13px] text-muted">{issue.reason}</p>
      {issue.suggestion && (
        <div className="mt-2 rounded-md bg-canvas-alt px-2.5 py-2 text-[13px]">
          <span className="text-xs text-muted">{issue.status === "auto_fixed" ? "수정된 문장" : "제안"}: </span>
          <span className="font-medium text-accent-text">{issue.suggestion}</span>
        </div>
      )}
      {issue.status === "reverted" && <p className="mt-2 text-xs font-medium text-unknown">자동 수정을 적용하지 않았습니다. 직접 확인해 주세요.</p>}
      {children && <div className="mt-3 flex flex-wrap items-center gap-2">{children}</div>}
    </article>
  );
}

// ---------- Evidence ----------

export function EvidencePanel({ project }: { project: ProjectRecord }) {
  const { data } = useLive(async () => ({ evidence: await listEvidence(project.id), images: await listImages(project.id) }), [project.id], ["evidence", "images"]);
  if (!data) return null;
  const { evidence, images } = data;
  const photoNo = (id: string | null) => images.findIndex((i) => i.id === id) + 1;
  const groups = [
    { key: "confirmed", title: "확인된 정보", icon: <CircleCheck className="size-4" />, color: "border-confirmed text-confirmed", items: evidence.filter((e) => e.type === "confirmed" && !e.isOpinion).map((e) => ({ id: e.id, text: e.content, meta: e.sourceType === "answer" ? "질문 답변" : e.sourceType === "brand" ? "브랜드 프로필" : e.sourceType === "memory" ? "콘텐츠 메모리" : "메모" })) },
    { key: "opinion", title: "사용자 의견", icon: <UserRound className="size-4" />, color: "border-ink text-ink", items: evidence.filter((e) => e.type === "confirmed" && e.isOpinion).map((e) => ({ id: e.id, text: e.content, meta: "의견으로 표현" })) },
    { key: "visual", title: "사진에서 확인", icon: <Eye className="size-4" />, color: "border-visual text-visual", items: evidence.filter((e) => e.type === "visual").map((e) => ({ id: e.id, text: e.content, meta: `사진 ${photoNo(e.sourceRef)}${e.confidence === "low" ? " · 신뢰도 낮음(관찰 표현만)" : ""}` })) },
    { key: "metadata", title: "촬영일 (EXIF)", icon: <Image className="size-4" />, color: "border-meta text-meta", items: evidence.filter((e) => e.type === "metadata").map((e) => ({ id: e.id, text: e.content, meta: e.userVerified ? "사용자 확인함 · 본문 사용 가능" : "미확인 · 본문에 쓰지 않음" })) },
    { key: "unknown", title: "확인되지 않음", icon: <CircleHelp className="size-4" />, color: "border-unknown text-unknown", items: evidence.filter((e) => e.type === "unknown").map((e) => ({ id: e.id, text: e.content, meta: "본문에서 생략" })) },
  ];
  return (
    <div className="space-y-4">
      <Notice tone="info" icon={<ShieldCheck className="size-4" />}>
        POSTORY는 확인되지 않은 경험을 지어내지 않습니다. 아래 근거만으로 글을 씁니다.
      </Notice>
      {groups.map((g) => (
        <section key={g.key}>
          <h3 className={cx("mb-2 flex items-center gap-1.5 text-sm font-semibold", g.color.split(" ")[1])}>
            {g.icon}
            {g.title} <span className="font-normal text-muted">({g.items.length})</span>
          </h3>
          {g.items.length === 0 ? (
            <p className="text-xs text-muted">없음</p>
          ) : (
            <ul className="space-y-1.5">
              {g.items.map((item) => (
                <li key={item.id} className={cx("rounded-md border-l-[3px] bg-surface px-3 py-2 shadow-[0_0_0_1px_var(--color-line)]", g.color.split(" ")[0])}>
                  <p className="text-[13px] text-ink">{item.text}</p>
                  <p className="mt-0.5 text-[11px] text-muted">{item.meta}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

// ---------- Versions ----------

const ORIGIN_LABEL: Record<ContentVersionOrigin, string> = {
  ai_generated: "AI 생성",
  ai_rewrite: "AI 품질 수정",
  section_regenerated: "섹션 재작성",
  user_edit: "직접 수정",
  issue_fix: "제안 적용",
  restored: "이전 버전 복원",
};

export function VersionsPanel({ content }: { content: ContentRecord }) {
  const toast = useToast();
  const { data: versions } = useLive(() => listVersions(content.id), [content.id], ["versions"]);
  if (!versions) return null;
  return (
    <ol className="space-y-2">
      {versions.map((v) => {
        const current = v.id === content.currentVersionId;
        return (
          <li key={v.id} className={cx("rounded-[10px] border p-3", current ? "border-accent bg-accent-tint/50" : "border-line bg-surface")}>
            <div className="flex items-center gap-2 text-sm">
              <History className="size-4 text-muted" aria-hidden />
              <span className="font-semibold text-ink">v{v.versionNo}</span>
              <span className="text-ink-2">{ORIGIN_LABEL[v.origin]}</span>
              {v.id === content.aiFinalVersionId && <span className="rounded bg-subtle px-1.5 text-[11px] text-muted">AI 최종본</span>}
              <span className="ml-auto text-xs text-muted">{relativeTime(v.updatedAt)}</span>
            </div>
            {current ? (
              <p className="mt-1.5 text-xs font-medium text-accent-text">현재 버전</p>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                className="mt-1.5"
                icon={<RotateCcw className="size-3.5" />}
                onClick={async () => {
                  await addVersion(content, v.data, "restored");
                  toast(`v${v.versionNo}으로 되돌렸습니다.`, "success");
                }}
              >
                이 버전으로 되돌리기
              </Button>
            )}
          </li>
        );
      })}
    </ol>
  );
}
