import { BookmarkPlus, Building2, Mic, Plus, Sparkles, Trash2, X } from "lucide-react";
import { useState } from "react";
import { INDUSTRY_LABELS, type Industry } from "@postory/quality";
import { VOICE_SAMPLE_MAX, VOICE_SAMPLE_MIN, type UserWord } from "@postory/shared";
import { Button, Card, Chip, cx, Field, Notice, Spinner, useToast } from "../components/ui";
import { api } from "../lib/api";
import { useLive } from "../lib/hooks";
import {
  addMemory,
  addUserWord,
  deleteBrand,
  deleteMemory,
  deleteUserWord,
  deleteVoiceProfile,
  emptyBrand,
  getVoiceProfile,
  listBrands,
  listMemory,
  listUserWords,
  saveBrand,
  saveVoiceProfile,
} from "../lib/profiles";
import { listProjects, logUsage } from "../lib/repo";
import type { BrandProfileRecord } from "../lib/types";

// Phase 2A — My Voice / Brand / 금칙어·선호 표현 / Content Memory (명세서 21·22장, 벤치마크 23장)

const TABS = [
  { key: "voice", label: "My Voice" },
  { key: "brand", label: "브랜드 프로필" },
  { key: "words", label: "금칙어·선호 표현" },
  { key: "memory", label: "콘텐츠 메모리" },
] as const;
type Tab = (typeof TABS)[number]["key"];

const input = "w-full rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-[15px] outline-none focus:border-accent focus:ring-3 focus:ring-accent/15";

// ---------- 공통: 토큰 목록 ----------

function TokenInput({ placeholder, onAdd, withReplacement }: { placeholder: string; onAdd: (word: string, replacement: string | null) => void; withReplacement?: boolean }) {
  const [word, setWord] = useState("");
  const [rep, setRep] = useState("");
  return (
    <form
      className="flex flex-wrap gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!word.trim()) return;
        onAdd(word.trim(), withReplacement ? rep.trim() || null : null);
        setWord("");
        setRep("");
      }}
    >
      <input value={word} onChange={(e) => setWord(e.target.value)} placeholder={placeholder} className={cx(input, "min-w-[160px] flex-1")} aria-label={placeholder} />
      {withReplacement && <input value={rep} onChange={(e) => setRep(e.target.value)} placeholder="바꿀 표현 (선택)" className={cx(input, "min-w-[140px] flex-1")} aria-label="바꿀 표현" />}
      <Button type="submit" icon={<Plus className="size-4" />}>
        추가
      </Button>
    </form>
  );
}

function Tokens({ items, onRemove, tone = "neutral" }: { items: { key: string; label: string }[]; onRemove: (key: string) => void; tone?: "neutral" | "alert" | "visual" }) {
  const styles = { neutral: "bg-subtle text-ink-2", alert: "bg-alert-soft text-alert", visual: "bg-visual-soft text-visual" };
  if (!items.length) return <p className="text-sm text-muted">아직 없습니다.</p>;
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((it) => (
        <li key={it.key} className={cx("inline-flex h-9 items-center gap-1 rounded-full pl-3 pr-1 text-sm", styles[tone])}>
          {it.label}
          <button type="button" className="grid size-7 place-items-center rounded-full hover:bg-black/5" onClick={() => onRemove(it.key)} aria-label={`${it.label} 삭제`}>
            <X className="size-3.5" />
          </button>
        </li>
      ))}
    </ul>
  );
}

// ---------- My Voice ----------

function VoiceTab() {
  const toast = useToast();
  const { data: profile, loading } = useLive(getVoiceProfile, [], ["voiceProfiles"]);
  const [samples, setSamples] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const current = samples ?? profile?.samples ?? ["", ""];

  async function analyze() {
    const filled = current.map((s) => s.trim()).filter(Boolean);
    if (filled.length < VOICE_SAMPLE_MIN) return toast(`글을 ${VOICE_SAMPLE_MIN}개 이상 넣어 주세요.`, "alert");
    if (filled.some((s) => s.length < 100)) return toast("글마다 100자 이상 넣어 주세요.", "alert");
    setBusy(true);
    try {
      const res = await api.analyzeVoice({ samples: filled });
      await logUsage("voice", res.usage);
      await saveVoiceProfile({ samples: filled, features: res.features });
      setSamples(null);
      toast("내 문체를 분석했습니다. 새 스토리에서 'My Voice 적용'을 켜세요.", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "분석에 실패했습니다.", "alert");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Spinner className="mx-auto" />;
  const f = profile?.features;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
      <Card className="space-y-4 p-5 sm:p-6">
        <div>
          <h2 className="text-lg font-semibold">내가 쓴 글 넣기</h2>
          <p className="mt-1 text-sm text-muted">
            예전에 쓴 블로그·SNS 글을 {VOICE_SAMPLE_MIN}~{VOICE_SAMPLE_MAX}개 붙여 넣으세요. 내용이 아니라 문장 길이, 말투, 자주 쓰는 표현 같은 &lsquo;쓰는 방식&rsquo;만 배웁니다.
          </p>
        </div>
        {current.map((s, i) => (
          <div key={i} className="relative">
            <textarea
              value={s}
              onChange={(e) => setSamples(current.map((x, j) => (j === i ? e.target.value : x)))}
              rows={5}
              maxLength={4000}
              placeholder={`글 ${i + 1} (100자 이상)`}
              className={cx(input, "resize-y pr-10 leading-relaxed")}
              aria-label={`샘플 글 ${i + 1}`}
            />
            <span className="absolute bottom-2 right-3 text-xs text-muted">{s.length}자</span>
            {current.length > VOICE_SAMPLE_MIN && (
              <button type="button" className="absolute right-2 top-2 grid size-8 place-items-center rounded text-muted hover:bg-subtle" onClick={() => setSamples(current.filter((_, j) => j !== i))} aria-label={`글 ${i + 1} 삭제`}>
                <X className="size-4" />
              </button>
            )}
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          {current.length < VOICE_SAMPLE_MAX && (
            <Button variant="ghost" size="sm" icon={<Plus className="size-4" />} onClick={() => setSamples([...current, ""])}>
              글 추가
            </Button>
          )}
          <Button variant="primary" className="ml-auto" loading={busy} icon={<Sparkles className="size-4" />} onClick={analyze}>
            {profile ? "다시 분석" : "내 문체 분석"}
          </Button>
        </div>
        <p className="text-xs text-muted">글은 이 브라우저에만 저장되며, 분석할 때만 AI 서버로 보냅니다.</p>
      </Card>

      <Card className="h-fit p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Mic className="size-5 text-accent" aria-hidden /> 내 문체
        </h2>
        {!f ? (
          <p className="mt-3 text-sm text-muted">아직 분석한 문체가 없습니다.</p>
        ) : (
          <>
            <p className="mt-3 rounded-[10px] bg-accent-tint px-3 py-2.5 text-sm font-medium text-accent-text">{f.summary}</p>
            <dl className="mt-4 space-y-3 text-sm">
              {[
                ["문장 길이", f.sentenceLength],
                ["말투", f.speechStyle],
                ["문단 구성", f.paragraphStyle],
                ["CTA 스타일", f.ctaStyle],
                ["자주 쓰는 표현", f.frequentExpressions.join(", ") || "—"],
                ["쓰지 않는 표현", f.avoidedExpressions.join(", ") || "—"],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-muted">{k}</dt>
                  <dd className="mt-0.5 text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            <Button
              variant="ghost"
              size="sm"
              className="mt-4"
              icon={<Trash2 className="size-4" />}
              onClick={async () => {
                if (!window.confirm("분석한 문체와 샘플 글을 삭제할까요?")) return;
                await deleteVoiceProfile();
                setSamples(null);
              }}
            >
              문체 삭제
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}

// ---------- Brand ----------

function BrandForm({ brand, onDone }: { brand: BrandProfileRecord; onDone: () => void }) {
  const toast = useToast();
  const [b, setB] = useState(brand);
  const set = (patch: Partial<BrandProfileRecord>) => setB((x) => ({ ...x, ...patch }));
  const text = (key: keyof BrandProfileRecord, label: string, placeholder: string, rows = 1) => (
    <Field label={label}>
      {rows > 1 ? (
        <textarea value={b[key] as string} onChange={(e) => set({ [key]: e.target.value })} rows={rows} placeholder={placeholder} className={cx(input, "resize-y")} />
      ) : (
        <input value={b[key] as string} onChange={(e) => set({ [key]: e.target.value })} placeholder={placeholder} className={input} />
      )}
    </Field>
  );
  return (
    <Card className="space-y-5 p-5 sm:p-6">
      {text("name", "브랜드 이름", "예: 성수 로스터리 ○○")}
      {text("description", "브랜드 소개", "사실만 적어 주세요. 이 내용은 글에서 '확인된 정보'로 쓰입니다.", 3)}
      {text("products", "제품·서비스", "예: 싱글 오리진 드립 커피, 원두 정기 배송", 2)}
      <div className="grid gap-5 sm:grid-cols-2">
        {text("targetCustomer", "타깃 고객", "예: 조용히 작업할 곳을 찾는 20~30대")}
        {text("keyMessage", "핵심 메시지", "예: 천천히 마시는 커피 한 잔")}
      </div>
      {text("toneAndManner", "Tone & Manner", "예: 차분하고 담백하게, 과장 없이")}
      <Field label="업종 태그" hint="해당 업종의 광고 표현 규제 사전을 추가로 적용합니다.">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(INDUSTRY_LABELS) as Industry[]).map((ind) => (
            <Chip key={ind} selected={b.industries.includes(ind)} onClick={() => set({ industries: b.industries.includes(ind) ? b.industries.filter((x) => x !== ind) : [...b.industries, ind] })}>
              {INDUSTRY_LABELS[ind]}
            </Chip>
          ))}
        </div>
      </Field>
      <Field label="브랜드 선호 표현">
        <div className="space-y-2">
          <Tokens items={b.preferredPhrases.map((p) => ({ key: p, label: p }))} onRemove={(k) => set({ preferredPhrases: b.preferredPhrases.filter((p) => p !== k) })} tone="visual" />
          <TokenInput placeholder="예: 천천히, 한 잔의 여유" onAdd={(w) => !b.preferredPhrases.includes(w) && set({ preferredPhrases: [...b.preferredPhrases, w] })} />
        </div>
      </Field>
      <Field label="브랜드 금칙어">
        <div className="space-y-2">
          <Tokens
            items={b.forbiddenWords.map((w) => ({ key: w.word, label: w.replacement ? `${w.word} → ${w.replacement}` : w.word }))}
            onRemove={(k) => set({ forbiddenWords: b.forbiddenWords.filter((w) => w.word !== k) })}
            tone="alert"
          />
          <TokenInput placeholder="예: 가성비" withReplacement onAdd={(w, r) => !b.forbiddenWords.some((x) => x.word === w) && set({ forbiddenWords: [...b.forbiddenWords, { word: w, replacement: r } satisfies UserWord] })} />
        </div>
      </Field>
      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        <Button variant="ghost" onClick={onDone}>
          취소
        </Button>
        <Button
          variant="primary"
          className="ml-auto"
          onClick={async () => {
            if (!b.name.trim()) return toast("브랜드 이름을 입력하세요.", "alert");
            await saveBrand({ ...b, name: b.name.trim() });
            toast("브랜드 프로필을 저장했습니다.", "success");
            onDone();
          }}
        >
          저장
        </Button>
      </div>
    </Card>
  );
}

function BrandTab() {
  const { data: brands } = useLive(listBrands, [], ["brandProfiles"]);
  const [editing, setEditing] = useState<BrandProfileRecord | null>(null);
  if (!brands) return <Spinner className="mx-auto" />;
  if (editing) return <BrandForm key={editing.id} brand={editing} onDone={() => setEditing(null)} />;
  return (
    <div className="space-y-4">
      <Notice tone="info">브랜드 소개·제품 정보는 사용자가 직접 등록한 사실로 취급되어 글에 쓰입니다. 확인되지 않은 수치나 효능은 넣지 마세요.</Notice>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {brands.map((b) => (
          <Card key={b.id} className="flex flex-col p-5">
            <p className="flex items-center gap-2 text-lg font-semibold text-ink">
              <Building2 className="size-5 text-accent" aria-hidden />
              {b.name}
            </p>
            <p className="mt-1 line-clamp-2 text-sm text-muted">{b.description || "소개 없음"}</p>
            <p className="mt-3 text-xs text-muted">
              {b.industries.map((i) => INDUSTRY_LABELS[i as Industry] ?? i).join(", ") || "업종 미지정"} · 금칙어 {b.forbiddenWords.length} · 선호 표현 {b.preferredPhrases.length}
            </p>
            <div className="mt-auto flex gap-2 pt-4">
              <Button size="sm" onClick={() => setEditing(b)}>
                편집
              </Button>
              <Button
                size="sm"
                variant="ghost"
                icon={<Trash2 className="size-4" />}
                onClick={async () => {
                  if (window.confirm(`'${b.name}' 브랜드 프로필을 삭제할까요?`)) await deleteBrand(b.id);
                }}
              >
                삭제
              </Button>
            </div>
          </Card>
        ))}
        <button
          type="button"
          onClick={() => setEditing(emptyBrand())}
          className="flex min-h-[170px] flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border border-dashed border-line-strong bg-canvas-alt text-sm font-medium text-ink-2 hover:border-accent hover:text-accent-text"
        >
          <Plus className="size-5 text-accent" aria-hidden />새 브랜드 프로필
        </button>
      </div>
    </div>
  );
}

// ---------- 금칙어·선호 표현 ----------

function WordsTab() {
  const { data: words } = useLive(listUserWords, [], ["userWords"]);
  if (!words) return <Spinner className="mx-auto" />;
  const forbidden = words.filter((w) => w.kind === "forbidden");
  const preferred = words.filter((w) => w.kind === "preferred");
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="space-y-4 p-5 sm:p-6">
        <div>
          <h2 className="text-lg font-semibold">내 금칙어 (Level 4)</h2>
          <p className="mt-1 text-sm text-muted">모든 콘텐츠에서 쓰지 않을 단어입니다. 생성할 때 피하고, 품질 검사에서 &lsquo;내 금칙어&rsquo;로 표시합니다.</p>
        </div>
        <Tokens items={forbidden.map((w) => ({ key: w.id, label: w.replacement ? `${w.word} → ${w.replacement}` : w.word }))} onRemove={deleteUserWord} tone="alert" />
        <TokenInput placeholder="쓰지 않을 단어" withReplacement onAdd={(w, r) => addUserWord("forbidden", w, r)} />
      </Card>
      <Card className="space-y-4 p-5 sm:p-6">
        <div>
          <h2 className="text-lg font-semibold">선호 표현</h2>
          <p className="mt-1 text-sm text-muted">자연스러울 때 우선 쓰도록 AI에 알려 줍니다.</p>
        </div>
        <Tokens items={preferred.map((w) => ({ key: w.id, label: w.word }))} onRemove={deleteUserWord} tone="visual" />
        <TokenInput placeholder="자주 쓰고 싶은 표현" onAdd={(w) => addUserWord("preferred", w, null)} />
      </Card>
    </div>
  );
}

// ---------- Content Memory ----------

function MemoryTab() {
  const { data } = useLive(
    async () => {
      const [ctas, products, projects] = await Promise.all([listMemory("cta"), listMemory("product"), listProjects()]);
      // 지난 프로젝트에서 쓴 CTA 중 아직 저장하지 않은 것을 제안
      const used = Array.from(new Set(projects.map((p) => p.masterStory?.cta).filter((c): c is string => !!c?.trim())));
      return { ctas, products, suggestions: used.filter((c) => !ctas.some((m) => m.title === c)).slice(0, 6) };
    },
    [],
    ["memoryItems", "projects"],
  );
  const [product, setProduct] = useState({ title: "", detail: "" });
  if (!data) return <Spinner className="mx-auto" />;
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="space-y-4 p-5 sm:p-6">
        <div>
          <h2 className="text-lg font-semibold">자주 쓰는 CTA</h2>
          <p className="mt-1 text-sm text-muted">새 스토리에서 골라 쓰면 글 마무리에 그대로 들어갑니다.</p>
        </div>
        <ul className="space-y-2">
          {data.ctas.map((m) => (
            <li key={m.id} className="flex items-center gap-2 rounded-[10px] bg-canvas-alt px-3 py-2.5 text-sm">
              <span className="flex-1 text-ink">{m.title}</span>
              <span className="text-xs text-muted">{m.useCount}회 사용</span>
              <button className="grid size-8 place-items-center rounded text-muted hover:bg-alert-soft hover:text-alert" onClick={() => deleteMemory(m.id)} aria-label="삭제">
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
        <TokenInput placeholder="예: 저장해 두고 주말에 들러 보세요." onAdd={(w) => addMemory("cta", w)} />
        {data.suggestions.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold text-muted">지난 글에서 쓴 CTA</p>
            <ul className="space-y-1.5">
              {data.suggestions.map((c) => (
                <li key={c} className="flex items-center gap-2 text-sm text-ink-2">
                  <span className="flex-1">{c}</span>
                  <Button size="sm" variant="ghost" icon={<BookmarkPlus className="size-4" />} onClick={() => addMemory("cta", c)}>
                    저장
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
      <Card className="space-y-4 p-5 sm:p-6">
        <div>
          <h2 className="text-lg font-semibold">제품·서비스 정보</h2>
          <p className="mt-1 text-sm text-muted">자주 소개하는 제품을 저장해 두면 매번 입력하지 않아도 됩니다. 사실만 적어 주세요.</p>
        </div>
        <ul className="space-y-2">
          {data.products.map((m) => (
            <li key={m.id} className="flex items-start gap-2 rounded-[10px] bg-canvas-alt px-3 py-2.5 text-sm">
              <span className="flex-1">
                <span className="font-semibold text-ink">{m.title}</span>
                {m.detail && <span className="mt-0.5 block text-muted">{m.detail}</span>}
              </span>
              <button className="grid size-8 place-items-center rounded text-muted hover:bg-alert-soft hover:text-alert" onClick={() => deleteMemory(m.id)} aria-label="삭제">
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!product.title.trim()) return;
            void addMemory("product", product.title, product.detail);
            setProduct({ title: "", detail: "" });
          }}
        >
          <input value={product.title} onChange={(e) => setProduct({ ...product, title: e.target.value })} placeholder="제품·서비스 이름" className={input} aria-label="제품 이름" />
          <textarea value={product.detail} onChange={(e) => setProduct({ ...product, detail: e.target.value })} placeholder="특징 (확인된 사실만)" rows={2} className={cx(input, "resize-y")} aria-label="제품 설명" />
          <Button type="submit" icon={<Plus className="size-4" />}>
            제품 추가
          </Button>
        </form>
      </Card>
    </div>
  );
}

export function VoicePage() {
  const [tab, setTab] = useState<Tab>("voice");
  return (
    <div className="mx-auto max-w-[1280px]">
      <h1 className="text-[28px] font-bold">내 보이스 · 브랜드</h1>
      <p className="mt-1 text-muted">내 문체와 브랜드를 기억해 두면, 새 스토리마다 같은 목소리로 글을 씁니다.</p>
      <div className="mt-6 flex gap-1 overflow-x-auto rounded-[12px] bg-subtle p-1" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cx("h-10 shrink-0 rounded-[10px] px-4 text-sm font-medium", tab === t.key ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink")}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="mt-5">
        {tab === "voice" && <VoiceTab />}
        {tab === "brand" && <BrandTab />}
        {tab === "words" && <WordsTab />}
        {tab === "memory" && <MemoryTab />}
      </div>
    </div>
  );
}
