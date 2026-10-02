import { z } from "zod";

// 계획서 3.3 생성 파이프라인 — 처리 화면의 6단계와 1:1.
// 로컬 MVP에서는 브라우저가 단계를 순서대로 호출하고, 단계마다 결과를 IndexedDB에 저장한다.

export const PIPELINE_STAGES = [
  { value: "analyze_images", label: "사진 분석" },
  { value: "organize_memory", label: "기억 정리" },
  { value: "check_missing", label: "필요한 정보 확인" },
  { value: "compose_story", label: "스토리 구성" },
  { value: "write_content", label: "콘텐츠 작성" },
  { value: "review_quality", label: "품질 검토" },
] as const;

export const PipelineStage = z.enum([
  "analyze_images",
  "organize_memory",
  "check_missing",
  "compose_story",
  "write_content",
  "review_quality",
]);
export type PipelineStage = z.infer<typeof PipelineStage>;

export const StageStatus = z.enum(["pending", "running", "done", "failed"]);
export type StageStatus = z.infer<typeof StageStatus>;
