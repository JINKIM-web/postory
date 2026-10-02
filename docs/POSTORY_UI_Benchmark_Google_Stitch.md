# POSTORY UI Benchmark & Google Stitch Design Brief

> **Purpose**  
> This document is a UI/UX benchmarking brief for designing the POSTORY web app in Google Stitch.  
> It combines the POSTORY project specification v1.1 with benchmark patterns from **Canva, Adobe Express, Predis.ai, Buffer, and Hootsuite**, while intentionally avoiding direct visual copying of any single product.

---

## 0. Executive Summary

### Product name
**POSTORY**

### Brand line
**One Story. Every Channel.**

### Korean brand line
**하나의 이야기를, 모든 채널에.**

### Product definition
POSTORY is an AI content creation web app that turns **a few photos + a short memo** into **publish-ready content** for:

- Blog
- Facebook
- Instagram
- YouTube Shorts

The core user promise is:

> **“사진 몇 장과 한 줄의 기억이면 충분하다.”**

POSTORY should feel simpler than a traditional social media management suite, more focused than a general AI writer, and more editorially trustworthy than a generic prompt-based content generator.

---

# 1. Design Goals

The UI must express these five product principles:

1. **Simple Input**
   - The user should never need to learn prompt engineering.
   - Upload photos, write a short memory, select purpose/tone/platform, and generate.

2. **Publish-ready Quality**
   - The UI must make quality review feel like a first-class capability.
   - The product should not feel like “AI draft generation.”

3. **Evidence-based Generation**
   - Facts, user opinions, image observations, and unknowns should be visually distinguishable when needed.
   - The app must build trust, not just speed.

4. **One Story → Multi-channel**
   - Users should understand that one Master Story becomes multiple platform outputs.
   - Blog, Facebook, Instagram, and Shorts are views of the same story, not disconnected generators.

5. **Blog-first, but not Blog-only**
   - Blog is the strongest long-form surface.
   - SNS conversion should feel immediate and lightweight.

---

# 2. Benchmark Services

## 2.1 Canva

### What to benchmark
- Extremely low-friction “start creating” flow
- Clear left navigation
- Visual-first asset cards
- Template-driven discovery
- AI features embedded in existing creation flows instead of isolated as a separate “AI mode”
- Large preview surfaces with contextual editing controls

### What POSTORY should adopt
- **Creation-first navigation**
- **Strong visual hierarchy**
- **Large central work canvas**
- **Inline AI actions**, not a chatbot-first interface
- **Cards for recent projects / recommended actions**
- Minimal learning curve

### What POSTORY should avoid
- Excessive template browsing
- Design-canvas complexity
- Too many creation categories on first screen

### POSTORY adaptation
POSTORY should borrow Canva’s feeling of:
> “I can start immediately.”

But replace design templates with:
> **“Upload photos → Add a short memory → Create story.”**

---

## 2.2 Adobe Express

### What to benchmark
- End-to-end workflow:
  **Create → Enhance → Schedule → Publish → Analyze**
- Strong content preview before publishing
- Unified creative and publishing workspace
- Channel selection before publishing
- Grid/calendar style content planning
- Rich but controlled interface density

### What POSTORY should adopt
- **Workflow continuity**
- Persistent preview while editing
- Clear “Ready to publish” state
- Platform preview modes
- Content scheduler pattern for Phase 2
- Accessibility-minded publishing controls

### What POSTORY should avoid
- Too many creative-editing capabilities in MVP
- Professional design-tool complexity

### POSTORY adaptation
POSTORY should feel like:
> **“Write once, see how it looks everywhere.”**

---

## 2.3 Predis.ai

### What to benchmark
- “One line is enough” creation model
- Whole-post generation, not caption-only generation
- Fast AI-first onboarding
- Brand-tone oriented outputs
- Platform-aware post creation
- Visual + caption + hashtag packaging

### What POSTORY should adopt
- **Single-input simplicity**
- AI generates a complete content package
- Clear “before input / after output” transformation
- Result-first UX

### What POSTORY should avoid
- Output that feels like a generic social post generator
- Too much emphasis on auto-generated graphics in MVP
- Over-automation that hides evidence or user control

### POSTORY adaptation
Predis proves that users understand:
> “Give one idea, receive a complete post.”

POSTORY evolves this to:
> **“Give real photos and real experience, receive a publish-ready story.”**

---

## 2.4 Buffer

### What to benchmark
- Calm and minimal interface
- Newer sidebar-oriented navigation
- Home dashboard that summarizes:
  - next scheduled posts
  - weekly metrics
  - unanswered comments
  - content inspiration
- Clear context switching between:
  - Create
  - Publish
  - Analytics
  - Community
- Low cognitive load

### What POSTORY should adopt
- **Calm SaaS dashboard**
- Compact left sidebar
- One clear primary CTA
- Recent work and next action on Home
- Minimal number of simultaneous decisions
- Strong empty states

### What POSTORY should avoid
- Showing advanced analytics too early
- Dense social-account management in MVP

### POSTORY adaptation
The POSTORY Dashboard should feel closest to Buffer in simplicity:
> **Recent stories + Create new + Ready to post**

---

## 2.5 Hootsuite

### What to benchmark
- Social OS approach
- Unified planning and publishing workspace
- Calendar/list dual views
- AI assistance inside content planning
- Recommended times and contextual suggestions
- Analytics and workflow states
- Multi-account scheduling and preview

### What POSTORY should adopt
- **Workflow status visibility**
- Future Phase 2 calendar
- “AI suggestion in context”
- Platform cards and publishing status
- Best-next-action hints

### What POSTORY should avoid
- Enterprise density
- Multi-column monitoring dashboards
- Too many metrics on the primary workspace
- Corporate admin-heavy visual language

### POSTORY adaptation
Hootsuite should influence **Phase 2 operations**, not MVP visual density.

---

# 3. Benchmark Synthesis

POSTORY should combine:

| Source | Pattern to borrow |
|---|---|
| Canva | visual simplicity + creation-first UX |
| Adobe Express | create-to-publish continuity |
| Predis.ai | one-line AI generation simplicity |
| Buffer | calm dashboard + lightweight navigation |
| Hootsuite | workflow state + future calendar/analytics |

### POSTORY should NOT look like:
- a chatbot
- a social listening dashboard
- a graphic design tool
- a template marketplace
- a generic AI writer

### POSTORY should look like:
> **A modern editorial AI workspace for turning real memories into channel-ready content.**

---

# 4. 2026 UI Direction for POSTORY

## 4.1 Overall visual character

Keywords:

- Editorial
- Calm
- Premium
- Modern
- Warm
- AI-assisted, not AI-dominated
- High-trust
- Content-first

Avoid:
- neon AI gradients everywhere
- glowing chatbot UI
- excessive glassmorphism
- gamer-style dark UI
- overly colorful dashboard cards
- enterprise-heavy tables on primary pages

---

# 5. Visual Design System

## 5.1 Color direction

### Primary
**Ink / Charcoal**
- Use for text, nav, main UI structure
- Conveys editorial trust

Suggested:
- `#171717`
- `#222222`

### Background
Warm neutral:
- `#FAFAF7`
- `#F7F7F3`

### Surface
- `#FFFFFF`

### Accent
A single warm, memorable POSTORY accent.

Recommended direction:
- Coral-orange / warm red-orange
- Example: `#F2664B`

Alternative:
- warm terracotta: `#D9654F`

### Success
- muted green, not bright neon

### Warning
- warm amber

### Critical
- restrained red

### Rule
Use color primarily for:
- CTA
- status
- quality issues
- selected channel
- active step

Do not color every card.

---

# 6. Typography

Recommended:
- **Pretendard / Inter / SUIT-like modern sans**
- Large editorial headings
- Compact UI labels
- Comfortable body line-height

### Hierarchy

**Display**
- 40–48px
- 700 weight

**Page Title**
- 28–32px
- 700

**Section**
- 20–24px
- 600–700

**Body**
- 15–16px
- 400–500

**Metadata**
- 12–13px

Blog content should use a wider line-height than dashboard text.

---

# 7. Layout System

## Desktop-first

POSTORY MVP is desktop-first with responsive mobile web support.

### Global layout
- Left sidebar: 224–248px
- Main content: centered max width 1200–1360px
- Editor pages may use wider canvas

### Sidebar
Top:
- POSTORY logo

Primary:
- Home
- Create
- Library

Secondary:
- My Voice *(Phase 2 badge)*
- Calendar *(Phase 2 badge)*
- Analytics *(Phase 2 badge)*

Bottom:
- Usage
- Settings
- User profile

### Top bar
Keep minimal.

Include:
- current project name
- autosave state
- help
- profile

---

# 8. Core Navigation

## MVP
1. Home
2. Create
3. Library

Editor-related screens are contextual and do not need permanent nav items.

## Phase 2
4. My Voice
5. Calendar
6. Analytics

---

# 9. Screen 01 — Dashboard / Home

## Goal
The user should understand what to do within 3 seconds.

### Hero area
Large headline:

> **오늘 어떤 이야기를 만들어볼까요?**

Subcopy:
> 사진 몇 장과 짧은 메모만 있으면 충분해요.

Primary CTA:
**새 콘텐츠 만들기**

Secondary CTA:
**사진부터 업로드**

### Quick Create card
A large, simple card with:
- drag & drop thumbnail area
- Quick Text input
- “콘텐츠 만들기” button

This allows creation directly from Dashboard.

### Recent projects
Card grid:
- thumbnail
- title
- category
- platforms
- status
- updated time

### Status chips
- Draft
- Generated
- Reviewed
- Ready
- Published

### Optional MVP usage
Small, unobtrusive:
- “이번 달 8/20개 생성”

### Do not put on Home in MVP
- complex analytics
- social account metrics
- trend charts
- content calendar

---

# 10. Screen 02 — Create

This is POSTORY’s most important input screen.

## Layout
Two-column desktop layout.

### Left — Media
Large image upload area.

States:
- empty
- uploading
- uploaded thumbnails
- reorder
- remove

Thumbnail grid:
- 2–4 columns
- numbered order badges
- subtle drag handles

### Right — Story Setup

#### Quick Text
Prominent large text area.

Label:
**어떤 기억을 콘텐츠로 만들고 싶나요?**

Placeholder:
> 지난 주말 성수동에서 들른 카페.  
> 커피가 좋았고 공간이 조용했다.

Helper:
> 길게 쓰지 않아도 됩니다.

#### Category
Use selectable chips/cards:
- 여행
- 일상
- 카페
- 맛집
- 제품
- 서비스
- 개인 브랜딩
- 정보/노하우

#### Goal
Use compact dropdown or segmented picker.

#### Tone
Compact chips:
- 담백한
- 친근한
- 전문적인
- 감성적인
- 세련된
- 유쾌한

Default:
**담백한**

#### Platform
Use visual channel cards:
- Blog
- Facebook
- Instagram
- YouTube Shorts

Multi-select.

Blog should appear first and slightly emphasized, but not forced.

### Primary action
Sticky bottom/right CTA:

**스토리 만들기**

Subtext:
> AI가 사진과 메모에서 확인 가능한 정보만 사용합니다.

---

# 11. Screen 03 — AI Processing

Do not show a spinner-only waiting state.

Use step-based progress:

1. 사진 분석 중
2. 기억 정리 중
3. 필요한 정보 확인 중
4. 스토리 구성 중
5. 콘텐츠 작성 중
6. 품질 검토 중

### Pattern
- horizontal stepper on desktop
- animated but restrained
- completed steps show checkmarks
- current step has subtle accent pulse

Optional:
show small evidence snippets as they are extracted:

> “주말 방문”  
> “파스타 주문”  
> “테라스 좌석 확인”

This increases trust.

---

# 12. Screen 04 — Smart Question

This should feel lightweight, not like a form.

### UI pattern
Centered card or right-side modal.

Title:
**조금만 더 알려주면 글이 더 자연스러워져요**

One question at a time.

Example:
> 어떤 메뉴가 가장 기억에 남았나요?

Choice buttons first.

Secondary:
**직접 입력**

Tertiary:
**건너뛰기**

Progress:
**1 / 3**

### UX principle
Never ask more than 4 questions.

---

# 13. Screen 05 — Content Editor

This is the main result workspace.

## Layout
Three-region workspace:

### Left
Platform navigation

- Blog
- Facebook
- Instagram
- YouTube Shorts

Only selected channels shown.

Use platform icons + labels.

### Center
Main content editor / preview

### Right
Context panel:
- Quality
- Evidence
- Versions
- Actions

Use tabs inside right panel instead of multiple permanent panels.

---

# 14. Blog Studio

Blog should feel more like a modern editorial writing environment than a social scheduler.

## Header
Project title
+
status:
**Ready / Needs review**

Actions:
- Save
- Copy
- Download

Primary:
**네이버 블로그용 복사**

---

## Blog title area

Show 3–5 AI title suggestions in a dropdown/popover.

Current title shown large.

Action:
**다른 제목 보기**

---

## Rich editor

Use a clean, document-like white canvas.

Width:
~760–820px readable column.

Support:
- H2/H3
- bold
- bullet
- numbered list
- quote
- paragraph
- image marker

### Image marker component
Not plain text.

Use a visual inline block:

**사진 2 — 파스타**
`[사진 삽입 위치]`

With thumbnail on left.

Actions:
- move
- replace
- remove marker

---

# 15. Blog Quality Panel

Right panel tab:
**Quality**

Use issue cards instead of a giant score.

### Top summary
**게시 준비 상태**

Example:
- 6개 항목 통과
- 2개 개선 제안

### Check groups
- 사실 근거
- 금칙어
- 과장 표현
- 검색 품질
- 키워드 반복
- AI 상투 표현
- 선택 톤

Each:
- Pass
- Improve
- Warning

### Issue card example
**과장 표현**
> “무조건 추천합니다”

Reason:
> 사용자 정보만으로 단정하기 어려운 표현입니다.

Buttons:
- **추천 수정 적용**
- 무시

This is a major POSTORY differentiator.

---

# 16. Evidence Panel

Right panel tab:
**Evidence**

Use grouped cards:

### 확인된 정보
Green-neutral indicator

### 사진에서 확인
Blue-neutral indicator

### 확인되지 않음
Gray/amber indicator

Example:

**확인된 정보**
- 토요일 방문
- 파스타가 가장 좋았음

**사진에서 확인**
- 야외 좌석
- 메뉴판 있음

**확인되지 않음**
- 가격대
- 영업시간
- 웨이팅

The user must clearly understand:
> POSTORY does not invent unknown experiences.

---

# 17. Section Regeneration UX

Do not use a global “Regenerate” as the main behavior.

Hover a section to reveal:
- Rewrite
- Shorter
- More natural
- More informative

If rewritten:
show subtle version diff.

Provide:
**이전 버전으로 돌아가기**

This follows the project requirement for Content Version history.

---

# 18. Blog Copy UX

Primary action:
**네이버 블로그용 복사**

Click opens a small confirmation sheet:

### Copy format
- Rich Text — Recommended
- Plain Text

### Include
- 제목
- 소제목
- Bold
- 리스트
- 이미지 위치 마커

Secondary:
**이미지 ZIP 다운로드**

Show:
> 사진 번호가 본문 마커와 일치합니다.

---

# 19. Facebook Output

Use post-preview style.

Header:
Facebook icon + “Facebook”

Editor at left or center.

Preview card:
- profile placeholder
- copy
- image carousel

Top actions:
- Rewrite
- Shorter
- More conversational

CTA:
**복사**

Phase 2:
**예약 게시**

---

# 20. Instagram Output

Use Instagram-like preview without cloning Instagram UI exactly.

Show:
- image carousel preview
- caption editor
- hashtags separated visually
- recommended first image

Controls:
- Hook
- Caption
- CTA
- Hashtags

Allow:
**첫 이미지로 설정**

Phase 2:
Publish / Schedule

---

# 21. YouTube Shorts Output

MVP is script/storyboard, not final video.

Use vertical storyboard cards.

### Left
9:16 preview frame

### Right
Scene list

Example:
**0–2s**
Hook

**2–5s**
Photo 1
Overlay

**5–9s**
Photo 2
Narration

Each scene card:
- media thumbnail
- duration
- overlay text
- narration

Top:
- Title
- Description
- Hashtags

Primary:
**스크립트 복사**

Phase 2:
**영상 만들기**

---

# 22. Screen 06 — Content Library

Benchmark Buffer simplicity.

### Toolbar
- Search
- Category
- Platform
- Status
- Date

### View
Default: cards

Optional:
list view

Card:
- cover thumbnail
- title
- category
- platform icons
- status
- updated date

Quick actions:
- Open
- Duplicate
- Delete

Do not make the library feel like a file manager.

---

# 23. Phase 2 — My Voice / Brand

Design should feel like a “profile of how I communicate.”

Sections:

### My Voice
- sentence length
- tone
- level of detail
- preferred expressions
- avoided expressions

### Brand
- description
- target audience
- key message
- product/service

### Forbidden Words
Simple table / token list

Avoid complex settings pages.

---

# 24. Phase 2 — Calendar

Benchmark Adobe Express + Hootsuite.

Views:
- Month
- Week

Each content card:
- thumbnail
- platform icon
- title
- status

Use drag-and-drop.

Color should identify status or channel subtly; avoid rainbow overload.

Right drawer:
- preview
- schedule
- platform
- publish status

---

# 25. Phase 2 — Analytics

Benchmark Buffer’s calm summary more than Hootsuite’s density.

Top:
- 3–4 KPI cards

Then:
- best content
- best channel
- performance trend

Most important:
**AI Insight card**

Example:
> 최근 Instagram에서는 음식 클로즈업 이미지의 저장 반응이 더 높았습니다.

CTA:
**이 패턴으로 새 콘텐츠 만들기**

Analytics must lead to action.

---

# 26. Interaction Principles

## 26.1 Progressive disclosure
Do not show every option initially.

Default:
- essential controls visible
- advanced options behind “더 보기”

## 26.2 AI should be contextual
Avoid a floating chatbot as the main interface.

AI actions should appear where needed:
- title
- section
- image
- quality issue
- channel conversion

## 26.3 User control
Every AI change must be reversible.

Use:
- apply
- ignore
- undo
- version history

## 26.4 Trust
Always make evidence-related warnings explicit.

## 26.5 Fast perceived performance
Use:
- progressive results
- skeletons
- step status
- early preview

Never use:
> “AI가 콘텐츠를 만드는 중입니다…”  
with only an indefinite spinner.

---

# 27. Component Inventory

Google Stitch should create reusable components for:

- AppSidebar
- TopBar
- PrimaryButton
- SecondaryButton
- StatusChip
- PlatformChip
- CategoryChip
- ToneChip
- ProjectCard
- UploadDropzone
- PhotoThumbnail
- QuickTextInput
- StepProgress
- SmartQuestionCard
- PlatformTabs
- RichTextEditor
- ImageMarkerBlock
- QualitySummary
- QualityIssueCard
- EvidenceCard
- VersionHistory
- CopyDialog
- StoryboardScene
- EmptyState
- Toast
- ConfirmDialog

---

# 28. Responsive Strategy

## Desktop
Primary target.

## Tablet
- Sidebar collapses to icons
- Right Quality panel becomes drawer

## Mobile
Creation should still work.

Mobile priorities:
1. upload
2. quick text
3. category
4. generate
5. view/copy output

Do not try to reproduce full desktop editor on mobile.

Use:
- bottom sheets
- full-screen editor
- sticky CTA

---

# 29. Accessibility

- WCAG AA contrast
- 44px minimum interactive target
- keyboard navigation
- focus state
- alt text support where applicable
- do not rely on color alone for status
- quality status must use icon + text + color

---

# 30. Empty States

## Home
> 아직 만든 이야기가 없어요.  
> 사진 몇 장으로 첫 콘텐츠를 만들어보세요.

Button:
**첫 콘텐츠 만들기**

## Library
> 저장된 프로젝트가 없습니다.

## Blog Quality
> 검토할 문제가 없습니다. 게시 준비가 완료되었습니다.

Avoid cartoon-heavy empty illustrations.
Use small editorial line illustration or photo placeholder.

---

# 31. Loading & System States

### Image upload
Progress per image

### AI generation
Step-based

### Failure
Keep completed stages.

Example:
> Instagram 변환 중 문제가 발생했습니다.  
> Blog과 Facebook 결과는 안전하게 저장되었습니다.

Button:
**Instagram만 다시 생성**

---

# 32. Brand Personality

POSTORY should feel:

- thoughtful
- composed
- useful
- trustworthy
- modern

POSTORY should not feel:
- flashy
- robotic
- overly technical
- salesy
- childish

---

# 33. Recommended Design Keywords for Google Stitch

Use these keywords:

> premium editorial SaaS, AI-assisted content workspace, calm modern dashboard, warm neutral background, content-first UI, generous whitespace, subtle cards, left navigation, rich text editor, photography-centered, multi-channel content editor, contextual AI actions, evidence-based quality review, sophisticated but approachable

Avoid:

> cyberpunk, neon AI, futuristic hologram, glassmorphism-heavy, dark gamer UI, enterprise monitoring dashboard, overly colorful cards

---

# 34. Google Stitch — Master Prompt

Copy the prompt below into Google Stitch.

---

## STITCH MASTER PROMPT

Design a responsive desktop-first SaaS web application called **POSTORY**.

POSTORY is an AI content creation platform with the brand line:

**“One Story. Every Channel.”**

Its core workflow is:

**Upload a few photos + write a short memory → AI extracts only evidence-supported facts → asks up to 4 lightweight follow-up questions if needed → creates one Master Story → generates publish-ready Blog, Facebook, Instagram, and YouTube Shorts content → runs a quality review → user edits and copies/publishes the result.**

The product is designed for personal branding users, creators, freelancers, small businesses, cafés, restaurants, product sellers, and local service businesses.

### Overall visual direction

Create a premium, calm, editorial SaaS interface.

The UI should feel:
- modern
- warm
- trustworthy
- highly usable
- content-first
- AI-assisted rather than AI-dominated

Avoid a chatbot-first interface.

Avoid neon AI gradients, excessive glassmorphism, overly colorful dashboards, enterprise monitoring density, or a graphic-design-tool look.

Use:
- warm off-white background
- white content surfaces
- charcoal/ink typography
- one warm coral or terracotta accent color
- subtle borders
- restrained shadows
- generous whitespace
- 10–14px corner radius
- modern Korean/Latin sans-serif typography
- strong editorial hierarchy

### Global layout

Use a left sidebar approximately 230px wide.

Navigation:

- Home
- Create
- Library

Below a separator, show Phase 2 features with a small “Soon” label:
- My Voice
- Calendar
- Analytics

Bottom:
- Usage
- Settings
- User profile

The top bar should be minimal and show project name, autosave status, help, and profile when relevant.

---

### Screen 1 — Home Dashboard

Create a welcoming dashboard.

Hero:
“오늘 어떤 이야기를 만들어볼까요?”

Subtitle:
“사진 몇 장과 짧은 메모만 있으면 충분해요.”

Primary CTA:
“새 콘텐츠 만들기”

Include a large Quick Create card with:
- photo drag-and-drop
- short text input
- button: “콘텐츠 만들기”

Below, show Recent Projects as clean image-based cards.

Each project card includes:
- cover photo
- title
- category
- Blog/Facebook/Instagram/YouTube platform icons
- status chip
- last updated time

Use status:
Draft / Generated / Reviewed / Ready / Published

Show monthly usage subtly.

Do not show analytics charts on the MVP dashboard.

---

### Screen 2 — Create

Use a two-column layout.

LEFT:
large photo upload area with thumbnail grid, drag-to-reorder, delete, and photo order numbers.

RIGHT:
Story Setup form.

Large Quick Text field:
Label:
“어떤 기억을 콘텐츠로 만들고 싶나요?”

Placeholder:
“지난 주말 성수동에서 들른 카페. 커피가 좋았고 공간이 조용했다.”

Helper:
“길게 쓰지 않아도 됩니다.”

Category chips:
여행 / 일상 / 카페 / 맛집 / 제품 / 서비스 / 개인 브랜딩 / 정보·노하우

Goal control:
정보 전달 / 후기 / 검색 유입 / 개인 브랜딩 / 제품 홍보 / 방문 유도 / 판매 유도 / 경험 공유

Tone chips:
담백한 / 친근한 / 전문적인 / 감성적인 / 세련된 / 유쾌한

Default tone:
담백한

Platform multi-select cards:
Blog
Facebook
Instagram
YouTube Shorts

Add a checkbox:
“광고·협찬 콘텐츠입니다”

Use a sticky primary CTA:
“스토리 만들기”

Below it:
“AI는 사진과 사용자가 제공한 정보에서 확인 가능한 내용만 사용합니다.”

---

### Screen 3 — AI Processing

Show a visual step-by-step generation state, not a spinner.

Steps:
1. 사진 분석
2. 기억 정리
3. 필요한 정보 확인
4. 스토리 구성
5. 콘텐츠 작성
6. 품질 검토

Show completed steps with checks.

Optionally reveal small extracted fact chips such as:
“주말 방문”
“파스타 주문”
“야외 좌석 확인”

Keep animation subtle.

---

### Screen 4 — Smart Question

Create a focused lightweight question interface.

Title:
“조금만 더 알려주면 글이 더 자연스러워져요”

One question per card.

Example:
“어떤 메뉴가 가장 기억에 남았나요?”

Use selectable answers first and a secondary “직접 입력” option.

Provide:
“건너뛰기”

Show small progress:
“1 / 3”

Never make it look like a long survey.

---

### Screen 5 — Main Content Editor

Use a three-region layout.

LEFT:
platform tabs:
Blog
Facebook
Instagram
YouTube Shorts

CENTER:
main editor or platform preview

RIGHT:
context panel tabs:
Quality
Evidence
Versions

Only show platforms selected by the user.

The main interface should communicate that all outputs come from one Master Story.

---

### Screen 6 — Blog Studio

Make this the most refined screen.

The center should look like a premium editorial document editor with a readable width around 780px.

Top:
project title
Ready / Needs review status

Actions:
Save
Download

Primary action:
“네이버 블로그용 복사”

Show current blog title large.

Provide “다른 제목 보기” to reveal 3–5 title suggestions.

Editor supports:
- H2/H3
- paragraphs
- bold
- bullet list
- numbered list
- quote
- image marker blocks

Image marker block should visually show:
thumbnail
“사진 2 — 파스타”
“사진 삽입 위치”

with move and remove controls.

On hover over a text section, reveal contextual AI actions:
- 다시 쓰기
- 더 짧게
- 더 자연스럽게
- 정보 보강

Do not place a generic large Regenerate button at the top.

---

### Right panel — Quality

Top summary:
“게시 준비 상태”

Example:
“6개 항목 통과 · 2개 개선 제안”

Show grouped checks:
- 사실 근거
- 금칙어
- 과장 표현
- 검색 품질
- 키워드 반복
- AI 상투 표현
- 선택 톤

Status:
Pass / Improve / Warning

Create issue cards.

Example:

Title:
“과장 표현”

Original:
“무조건 추천합니다”

Reason:
“사용자 정보만으로 단정하기 어려운 표현입니다.”

Buttons:
“추천 수정 적용”
“무시”

Quality review is a core POSTORY differentiator and should be visually important but not alarming.

---

### Right panel — Evidence

Group evidence into:

“확인된 정보”
“사진에서 확인”
“확인되지 않음”

Example:

확인된 정보:
- 토요일 방문
- 파스타가 가장 좋았음

사진에서 확인:
- 야외 좌석
- 메뉴판 있음

확인되지 않음:
- 가격대
- 영업시간
- 웨이팅

Use subtle semantic icons and colors.

The UI must clearly communicate:
“POSTORY does not invent unknown experiences.”

---

### Copy dialog

When the user selects:
“네이버 블로그용 복사”

Open a modal:

Title:
“블로그용 콘텐츠 복사”

Options:
- Rich Text — Recommended
- Plain Text

Include checklist:
- 제목
- 소제목
- Bold
- 리스트
- 이미지 위치 마커

Secondary:
“이미지 ZIP 다운로드”

Helper:
“이미지 파일 번호가 본문의 사진 번호와 일치합니다.”

---

### Facebook result

Create an editable Facebook-style content preview.

Use:
Hook → Story → Key Message → CTA

Actions:
Rewrite
Shorter
More conversational

Primary:
“복사”

---

### Instagram result

Create a visual Instagram-oriented preview.

Show:
- image carousel
- recommended first photo
- Hook
- Caption
- CTA
- Hashtags

Allow:
“첫 이미지로 설정”

Primary:
“복사”

---

### YouTube Shorts result

MVP is storyboard and script, not video generation.

Show a 9:16 vertical preview and scene cards.

Scene card fields:
- time range
- thumbnail
- overlay text
- narration

Example:
0–2s Hook
2–5s Photo 1 + Overlay
5–9s Photo 2 + Narration
9–15s Key Point
15–20s CTA

Also show:
- Title
- Description
- Hashtags

Primary:
“스크립트 복사”

Show disabled/Soon action:
“영상 만들기”

---

### Screen 7 — Content Library

Use a clean card-first content library.

Top filters:
Search
Category
Platform
Status
Date

Each card:
- image
- project title
- category
- platform icons
- status
- last updated

Quick actions:
Open
Duplicate
Delete

Keep it lighter than a file manager.

---

### Phase 2 screen direction

My Voice:
show communication style, preferred expressions, forbidden words, brand profile.

Calendar:
month/week planning view inspired by modern social scheduling tools, with thumbnail cards and platform indicators.

Analytics:
use a calm Buffer-like dashboard with only 3–4 key metrics, best content, channel comparison, and a prominent AI Insight card.

Example insight:
“최근 Instagram에서는 음식 클로즈업 이미지의 저장 반응이 더 높았습니다.”

CTA:
“이 패턴으로 새 콘텐츠 만들기”

---

### Interaction rules

Use progressive disclosure.

AI actions should be contextual, not chatbot-based.

Every AI edit must support undo/version history.

Use autosave.

Show step-by-step AI generation progress.

If one platform generation fails, preserve successful content and allow retry for only the failed platform.

For desktop use a persistent sidebar.

On tablet collapse the sidebar.

On mobile prioritize:
Upload → Quick Text → Category → Generate → View/Copy.

The right Quality/Evidence panel becomes a bottom sheet or drawer on small screens.

---

### Accessibility

Follow WCAG AA contrast.

Use at least 44px click targets.

Provide keyboard focus states.

Never communicate status using color alone.

Use icons + labels + color.

---

### Final visual goal

The design should feel like the intersection of:

- Canva’s approachable creation UX
- Adobe Express’s create-to-publish continuity
- Predis.ai’s one-line generation simplicity
- Buffer’s calm navigation and dashboard
- Hootsuite’s workflow visibility

But the final design must have its own identity:

**POSTORY = a premium editorial AI workspace that transforms real photos and real experiences into publish-ready stories for every channel.**

