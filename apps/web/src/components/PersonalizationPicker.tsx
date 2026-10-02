import { Mic, Settings2 } from "lucide-react";
import { Link } from "react-router";
import { useLive } from "../lib/hooks";
import { getVoiceProfile, listBrands, listMemory } from "../lib/profiles";
import type { ProjectRecord } from "../lib/types";
import { Chip, cx, Field } from "./ui";

// 새 스토리 입력 — Phase 2A 개인화 선택 (My Voice, 브랜드, 제품, CTA)

export function PersonalizationPicker({ form, set }: { form: ProjectRecord; set: (patch: Partial<ProjectRecord>) => void }) {
  const { data } = useLive(
    async () => ({ voice: await getVoiceProfile(), brands: await listBrands(), products: await listMemory("product"), ctas: await listMemory("cta") }),
    [],
    ["voiceProfiles", "brandProfiles", "memoryItems"],
  );
  if (!data) return null;
  const empty = !data.voice && !data.brands.length && !data.products.length && !data.ctas.length;

  if (empty) {
    return (
      <Link to="/voice" className="flex items-center gap-3 rounded-[10px] border border-dashed border-line-strong p-4 text-sm text-ink-2 hover:border-accent">
        <Settings2 className="size-5 text-accent" aria-hidden />
        <span>
          <span className="font-semibold text-ink">내 문체·브랜드로 쓰기</span>
          <span className="block text-xs text-muted">예전 글을 등록하면 내 말투로, 브랜드를 등록하면 브랜드 톤으로 씁니다.</span>
        </span>
      </Link>
    );
  }

  return (
    <div className="space-y-5 rounded-[10px] border border-line p-4">
      <p className="flex items-center justify-between text-[15px] font-semibold text-ink">
        개인화
        <Link to="/voice" className="text-xs font-normal text-muted underline-offset-2 hover:underline">
          관리
        </Link>
      </p>
      {data.voice && (
        <label className={cx("flex cursor-pointer gap-3 rounded-[10px] border p-3", form.useVoice ? "border-accent bg-accent-tint/60" : "border-line")}>
          <input type="checkbox" checked={form.useVoice} onChange={(e) => set({ useVoice: e.target.checked })} className="mt-1 size-4 accent-[var(--color-accent)]" />
          <span>
            <span className="flex items-center gap-1.5 font-semibold text-ink">
              <Mic className="size-4" aria-hidden /> My Voice 적용
            </span>
            <span className="mt-0.5 block text-xs text-muted">{data.voice.features.summary}</span>
          </span>
        </label>
      )}
      {data.brands.length > 0 && (
        <Field label="브랜드 프로필" aside="업종 사전·금칙어도 함께 적용">
          <div className="flex flex-wrap gap-2">
            <Chip selected={!form.brandId} onClick={() => set({ brandId: null })}>
              적용 안 함
            </Chip>
            {data.brands.map((b) => (
              <Chip key={b.id} selected={form.brandId === b.id} onClick={() => set({ brandId: b.id })}>
                {b.name}
              </Chip>
            ))}
          </div>
        </Field>
      )}
      {data.products.length > 0 && (
        <Field label="소개할 제품·서비스" aside="확인된 정보로 사용">
          <div className="flex flex-wrap gap-2">
            {data.products.map((m) => (
              <Chip
                key={m.id}
                selected={form.productIds.includes(m.id)}
                onClick={() => set({ productIds: form.productIds.includes(m.id) ? form.productIds.filter((x) => x !== m.id) : [...form.productIds, m.id] })}
              >
                {m.title}
              </Chip>
            ))}
          </div>
        </Field>
      )}
      {data.ctas.length > 0 && (
        <Field label="마무리 CTA">
          <select
            value={form.ctaId ?? ""}
            onChange={(e) => set({ ctaId: e.target.value || null })}
            className="h-11 w-full rounded-[10px] border border-line bg-surface px-3 text-sm outline-none focus:border-accent"
          >
            <option value="">AI가 목적에 맞게 작성</option>
            {data.ctas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        </Field>
      )}
    </div>
  );
}
