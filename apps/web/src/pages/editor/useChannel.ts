import { useEffect, useRef, useState } from "react";
import type { ChannelContent, ContentVersionOrigin } from "@postory/shared";
import { useDebouncedCallback, useLive } from "../../lib/hooks";
import { saveUserEdit } from "../../lib/pipeline";
import { addVersion, getContent, getVersion } from "../../lib/repo";
import { withSaving } from "../../lib/saveState";
import type { ContentRecord, VersionRecord } from "../../lib/types";

// 채널 콘텐츠 편집 상태: 현재 버전을 불러와 로컬 초안으로 편집하고, 멈추면 자동 저장한다.
// 외부 변경(이슈 수정 적용, 버전 복원, 재생성)이 생기면 초안을 그 버전으로 바꾼다.

export interface ChannelDraft<T extends ChannelContent = ChannelContent> {
  draft: T | null;
  version: VersionRecord | undefined;
  // 외부에서 버전이 바뀔 때마다 증가 (편집기 내용을 다시 불러오는 신호)
  externalRev: number;
  update: (next: T) => void;
  // 사용자 편집이 아닌 변경(AI 재작성 등)을 새 버전으로 저장
  commit: (next: T, origin: ContentVersionOrigin) => Promise<void>;
  flush: () => void;
}

export function useChannelDraft<T extends ChannelContent>(content: ContentRecord | undefined): ChannelDraft<T> {
  const { data: version } = useLive(() => getVersion(content?.currentVersionId ?? null), [content?.currentVersionId], ["versions"]);
  const [draft, setDraft] = useState<T | null>(null);
  const [externalRev, setExternalRev] = useState(0);
  const synced = useRef<string | null>(null);

  useEffect(() => {
    if (!version) {
      if (!content?.currentVersionId) setDraft(null);
      return;
    }
    const json = JSON.stringify(version.data);
    if (json !== synced.current) {
      synced.current = json;
      setDraft(version.data as T);
      setExternalRev((r) => r + 1);
    }
  }, [version, content?.currentVersionId]);

  const save = useDebouncedCallback((next: T) => {
    if (!content) return;
    synced.current = JSON.stringify(next);
    void withSaving(() => saveUserEdit(content.id, next));
  }, 1200);

  return {
    draft,
    version,
    externalRev,
    update: (next) => {
      setDraft(next);
      save(next);
    },
    commit: async (next, origin) => {
      if (!content) return;
      save.flush();
      const fresh = (await getContent(content.id)) ?? content;
      await withSaving(() => addVersion(fresh, next, origin));
    },
    flush: save.flush,
  };
}
