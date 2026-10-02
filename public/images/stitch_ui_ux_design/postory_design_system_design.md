# POSTORY Design System (design.md)

**Brand Statement:** One Story. Every Channel. (하나의 이야기를, 모든 채널에.)  
**Product Core:** 사진 몇 장과 한 줄의 기억을 근거(Evidence) 기반으로 정제하여, 네이버 블로그 및 SNS(인스타그램, 페이스북, 유튜브 쇼츠)에 바로 게시 가능한 완성형 콘텐츠로 완성하는 모던 에디토리얼 AI 워크스페이스.

---

## 1. Design Principles (디자인 철학 및 원칙)

1. **Editorial Calmness (차분한 에디토리얼 감성)**
   - 자극적인 네온 AI 그라데이션이나 챗봇 형태를 지양하고, 글과 사진에 온전히 집중할 수 있는 잡지·출판 스튜디오의 품격을 유지합니다.
2. **Evidence-based Trust (근거 기반 신뢰성)**
   - AI가 정보를 임의로 지어내지 않으며, 사용자가 제공한 기억(Confirmed), 사진 분석(Visual), 촬영일시(Metadata), 미확인(Unknown) 정보를 투명하게 시각화합니다.
3. **One Story → Multi-channel Hub (원소스 멀티채널 연결성)**
   - 개별 채널마다 생성기를 따로 돌리는 것이 아닌, 하나의 탄탄한 'Master Story'를 바탕으로 각 플랫폼(블로그, 인스타, 페이스북, 쇼츠) 규격에 완벽히 최적화된 결과물을 즉시 확인하고 복사할 수 있습니다.
4. **Publish-Ready Polish (즉시 게시 가능한 완성도)**
   - 단순한 초안 작성이 아닌, 소제목, 볼드 강조, 사진 위치 마커(`[사진 1 삽입]`), 글자수/해시태그 검증 및 금칙어·과장표현 사전 점검이 끝난 고품질 콘텐츠를 제공합니다.

---

## 2. Color Palette & Semantic Tokens (색상 체계)

### Primary Neutral (인크 & 차콜)
- **Primary Ink:** `#171717` (메인 타이틀, 주요 버튼, 헤드라인)
- **Charcoal Text:** `#262626` (본문, 레이블)
- **Muted Gray:** `#737373` (보조 설명, 플레이스홀더, 메타데이터)
- **Border Subtle:** `#EAEAE5` / `#E5E5E0` (카드 테두리, 구분선)
- **Border Active:** `#D1D1CB`

### Backgrounds & Surfaces (따뜻한 웜 뉴트럴)
- **Canvas Background:** `#FAFAF7` (눈의 피로를 덜어주는 부드러운 웜 아이보리 뉴트럴)
- **Surface Card:** `#FFFFFF` (컨텐츠 카드, 에디터 본문 서피스)
- **Surface Subtle:** `#F4F4F0` (사이드바 인셋, 태그 배경, 테이블 헤더)
- **Surface Raised:** `#FFFFFF` (모달, 드롭다운, 팝오버)

### Accent & Brand Identity (포스토리 시그니처)
- **Coral Accent:** `#F2664B` (핵심 CTA, 활성 플랫폼 배지, 주요 링크)
- **Accent Hover:** `#E05338`
- **Accent Soft Tint:** `#FFF1EE` (선택된 칩 배경, 하이라이트 배지)

### Semantic & Evidence Status
- **Confirmed Fact (확인된 사실):** Emerald `#16A34A` / Soft `#F0FDF4`
- **Visual Fact (사진 분석):** Indigo Blue `#2563EB` / Soft `#EFF6FF`
- **Metadata Fact (촬영일시 EXIF):** Slate `#475569` / Soft `#F1F5F9`
- **Unknown (미확인 정보):** Warm Amber `#D97706` / Soft `#FEF3C7`
- **Quality Alert (주의/과장표현):** Coral Red `#DC2626` / Soft `#FEF2F2`

---

## 3. Typography System (타이포그래피 규격)

- **Font Family:** `Pretendard`, `-apple-system`, `BlinkMacSystemFont`, `Inter`, `sans-serif`
- **Letter Spacing:** Titles `-0.02em`, Body `-0.01em`

| Level | Size | Weight | Line Height | Usage |
|---|---|---|---|---|
| **Display Hero** | 36px–40px | 700 Bold | 1.3 | 대시보드 웰컴 헤드라인 ("오늘 어떤 이야기를...") |
| **Page Title** | 28px–30px | 700 Bold | 1.35 | 에디터 프로젝트명, 메인 페이지 헤더 |
| **Section Title** | 20px–22px | 600 SemiBold | 1.4 | 모듈 헤딩, 카드 그룹 타이틀, 블로그 H2 |
| **Subheading** | 17px–18px | 600 SemiBold | 1.5 | 블로그 H3, 패널 탭 헤더, 폼 레이블 |
| **Editor Body** | 16px | 400 Regular | 1.75 | 블로그 에디토리얼 리딩 본문 (가독성 최적화) |
| **UI Body / Inputs** | 14px–15px | 500 Medium | 1.5 | 버튼, 드롭다운, 일반 UI 텍스트 |
| **Caption & Meta** | 12px–13px | 500 Medium | 1.4 | 태그 칩, 플랫폼 아이콘 레이블, 타임스탬프 |

---

## 4. Layout & Grid Architecture (레이아웃 구조)

### A. Navigation Shell (App Shell)
- **Left Sidebar:** `240px` 고정 폭, `sticky h-screen`
  - 상단: POSTORY 로고 + 슬로건 마크
  - 메인 메뉴: 홈(Home), 새 스토리(Create), 라이브러리(Library)
  - Phase 2 세그먼트 (Soon 배지): My Voice, 캘린더, 성과 분석
  - 하단: 사용량 인디케이터 ("이번 달 8/20개 사용"), 설정, 프로필
- **Top Bar:** 슬림 `56px` 높이, 브레드크럼, 프로젝트 상태(Draft/Ready/Published), 자동저장 인디케이터, 도움말 및 사용자 계정

### B. Core Screens Layout
1. **Screen 01 — Dashboard (Home)**
   - Hero 섹션 + 인라인 Quick Create 카드 (드래그앤드롭 사진 업로드 + 한 줄 메모로 즉시 시작)
   - 최근 프로젝트 그리드 카드 (커버 사진, 플랫폼 아이콘, 상태 태그, 편집일시)
2. **Screen 02 — Story Studio (Create Input)**
   - 2컬럼 레이아웃: 좌측 미디어 드롭존(사진 1~10장, 순서 번호, 드래그 순서 재배치) + 우측 스토리 셋업(기억 메모, 카테고리 칩, 톤 선택, 멀티채널 선택, 광고/협찬 체크박스)
3. **Screen 03 — Multi-channel Content Editor (Blog Studio 중심)**
   - 좌측: 선택 채널 탭 (네이버 블로그, 인스타그램, 페이스북, 유튜브 쇼츠)
   - 중앙: 780px 고폭 에디토리얼 독자 친화형 리치 텍스트 뷰 (AI 제목 3~5선 제안, 인라인 사진 마커 블록 `[사진 1 — 외관 전경]`, 섹션별 컨텍스트 AI 재작성 툴바)
   - 우측: 검증 패널 탭
     - **Quality:** 게시 준비도 점수, 사실 근거/과장표현/금칙어/검색 품질 체크 및 원클릭 추천 수정 적용
     - **Evidence:** 확인된 사실 / 사진 분석 근거 / 미확인 정보 그룹핑
     - **Versions:** 생성 및 재작성 히스토리
   - 모달: 네이버 블로그 고품질 Rich Text / Plain Text 원클릭 복사 & 사진 번호 매칭 ZIP 다운로드 다이얼로그

---

## 5. Reusable Component Patterns (핵심 컴포넌트)

1. **PhotoMarkerBlock (`[사진 N 삽입]`):** 
   - 썸네일 프리뷰 + 사진 순번 레이블 + 위치 이동/교체/삭제 인라인 액션
2. **QualityIssueCard:**
   - 이슈 유형(과장표현/금칙어/검색품질) 태그 + 문제 문장 + 이유 + '추천 수정 적용' 버튼
3. **SmartQuestionCard:**
   - 부족한 사실을 묻는 질문 + 선택형 빠른 답변 버튼 + 직접 입력 + 건너뛰기
4. **ChannelTab & Preview Switcher:**
   - 플랫폼별 아이콘 + 상태 닷(Ready/Reviewing) + 1클릭 채널 전환
5. **CopyModal:**
   - 스마트에디터 호환 서식 복사 가이드 및 이미지 일괄 패키징 안내

---

## 6. Implementation Notes for Production

- 네이버 스마트에디터 연동은 Clipboard API의 `text/html`과 `text/plain` 멀티 마임 포맷 복사 지원.
- 사진에서 EXIF(GPS 정보 제거, 촬영일시만 메타데이터 팩트로 승격) 보안 준수.
- 에디터 내에서는 섹션 단위 AI 미세 튜닝(`더 자연스럽게`, `핵심 강조`, `짧게 줄이기`) 인터랙션 제공.
