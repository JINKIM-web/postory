import type {
  Category,
  ChannelContent,
  ContentVersionOrigin,
  EvidenceItem,
  EventType,
  Goal,
  MasterStory,
  PipelineStage,
  Platform,
  ProjectStatus,
  ReviewIssue,
  SmartQuestion,
  StageStatus,
  Tone,
  UsageInfo,
  UserWord,
  VoiceFeatures,
} from "@postory/shared";

// IndexedDB에 저장하는 로컬 레코드 (명세서 35.1 데이터 모델의 로컬 MVP 버전)

export interface ProjectRecord {
  id: string;
  title: string;
  // 사용자가 제목을 직접 바꿨으면 자동 제목으로 덮어쓰지 않는다
  titleEdited: boolean;
  category: Category | null;
  goal: Goal | null;
  tone: Tone;
  platforms: Platform[];
  hasSponsorship: boolean;
  status: ProjectStatus;
  quickText: string;
  industries: string[];
  industriesConfirmed: boolean;
  masterStory: MasterStory | null;
  stages: Partial<Record<PipelineStage, StageStatus>>;
  stageError: { stage: PipelineStage; message: string; retryable: boolean } | null;
  faceWarning: boolean;
  // 생성할 때마다 1씩 증가. 채널 결과가 이번 생성에서 만들어졌는지 판단한다
  generationNo: number;
  // Phase 2A 개인화 선택
  useVoice: boolean;
  brandId: string | null;
  productIds: string[];
  ctaId: string | null;
  publishedMarkedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Attribution {
  provider: "pixabay" | "unsplash";
  author: string;
  authorUrl: string;
  pageUrl: string;
}

export interface ImageRecord {
  id: string;
  projectId: string;
  sortOrder: number;
  source: "user" | "pixabay" | "unsplash";
  caption: string | null;
  // 사용자가 직접 입력한 캡션은 AI 분석으로 덮어쓰지 않는다
  captionEdited: boolean;
  // EXIF 촬영일시 (ISO). GPS는 읽지도 저장하지도 않는다
  takenAt: string | null;
  // EXIF가 제거된 저장본 / 분석용 저해상도본 / 썸네일. Unsplash는 URL만 쓴다
  stored: Blob | null;
  analysis: Blob | null;
  thumb: Blob | null;
  externalUrl: string | null;
  externalThumbUrl: string | null;
  width: number;
  height: number;
  attribution: Attribution | null;
  visualFacts: { text: string; confidence: "high" | "low" }[];
  hasPeople: boolean;
  createdAt: string;
}

export interface EvidenceRecord extends EvidenceItem {
  projectId: string;
  createdAt: string;
}

export interface QuestionRecord extends SmartQuestion {
  projectId: string;
  createdAt: string;
}

export interface ContentRecord {
  id: string;
  projectId: string;
  platform: Platform;
  generationNo: number;
  currentVersionId: string | null;
  // AI 최종 생성본 (Copy-ready Rate 기준, 명세서 39.3)
  aiFinalVersionId: string | null;
  state: "ok" | "failed";
  error: string | null;
  reviewError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VersionRecord {
  id: string;
  contentId: string;
  projectId: string;
  versionNo: number;
  origin: ContentVersionOrigin;
  data: ChannelContent;
  createdAt: string;
  updatedAt: string;
}

export interface IssueRecord extends Omit<ReviewIssue, "status"> {
  id: string;
  contentId: string;
  projectId: string;
  status: "open" | "auto_fixed" | "accepted" | "ignored" | "reverted";
  createdAt: string;
}

export interface EventRecord {
  id: string;
  projectId: string;
  contentId: string | null;
  versionId: string | null;
  eventType: EventType;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface UsageRecord extends UsageInfo {
  id: string;
  projectId: string;
  createdAt: string;
}

// ---------- Phase 2A: Personalization (명세서 21·22장, 35.2) ----------

export interface VoiceProfileRecord {
  id: string;
  // 분석에 쓴 내 글 (이 브라우저에만 저장, 다시 분석할 때 사용)
  samples: string[];
  features: VoiceFeatures;
  createdAt: string;
  updatedAt: string;
}

export interface BrandProfileRecord {
  id: string;
  name: string;
  description: string;
  products: string;
  targetCustomer: string;
  keyMessage: string;
  toneAndManner: string;
  industries: string[];
  preferredPhrases: string[];
  forbiddenWords: UserWord[];
  createdAt: string;
  updatedAt: string;
}

// 브랜드와 무관하게 늘 적용하는 내 금칙어·선호 표현
export interface UserWordRecord extends UserWord {
  id: string;
  kind: "forbidden" | "preferred";
  createdAt: string;
}

// Content Memory: 자주 쓰는 CTA, 제품·서비스 정보 (명세서 22장)
export interface MemoryItemRecord {
  id: string;
  kind: "cta" | "product";
  title: string;
  // product: 사용자가 확인한 제품 정보 (Confirmed Fact로 사용)
  detail: string;
  useCount: number;
  lastUsedAt: string | null;
  createdAt: string;
}
