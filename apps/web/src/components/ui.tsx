import { Camera, Clapperboard, FileText, LoaderCircle, MessageCircle, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { PLATFORMS, PROJECT_STATUSES, labelOf, type Platform, type ProjectStatus } from "@postory/shared";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

// ---------- Button ----------

type Variant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  variant = "secondary",
  size = "md",
  loading,
  icon,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "lg"; loading?: boolean; icon?: ReactNode }) {
  const styles: Record<Variant, string> = {
    primary: "bg-accent text-white hover:bg-accent-hover border border-transparent shadow-[var(--shadow-float)]",
    secondary: "bg-surface text-ink border border-line hover:bg-canvas-alt hover:border-line-strong",
    ghost: "bg-transparent text-ink-2 border border-transparent hover:bg-subtle",
    danger: "bg-alert-soft text-alert border border-red-200 hover:bg-red-100",
  };
  const sizes = { sm: "h-9 px-3 text-[13px] gap-1.5", md: "h-11 px-4 text-sm gap-2", lg: "h-12 px-5 text-[15px] gap-2" };
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center rounded-[var(--radius-btn)] font-semibold transition-colors active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap",
        styles[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}

// ---------- Chips ----------

export function Chip({ selected, children, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cx(
        "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors",
        selected ? "border-accent bg-accent-tint text-accent-text" : "border-line bg-surface text-ink-2 hover:border-line-strong",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

const STATUS_STYLE: Record<ProjectStatus, string> = {
  draft: "bg-canvas-alt text-muted",
  generated: "bg-unknown-soft text-unknown",
  reviewed: "bg-visual-soft text-visual",
  ready: "bg-confirmed-soft text-confirmed",
  published: "bg-subtle text-ink",
};
const STATUS_KO: Record<ProjectStatus, string> = { draft: "초안", generated: "생성 완료", reviewed: "검토 완료", ready: "게시 준비", published: "게시 완료" };

export function StatusChip({ status, className }: { status: ProjectStatus; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium", STATUS_STYLE[status], className)}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {labelOf(PROJECT_STATUSES, status)} <span className="opacity-80">({STATUS_KO[status]})</span>
    </span>
  );
}

const PLATFORM_ICON: Record<Platform, typeof FileText> = { blog: FileText, facebook: MessageCircle, instagram: Camera, shorts: Clapperboard };
export const PLATFORM_KO: Record<Platform, string> = { blog: "네이버 블로그", facebook: "페이스북", instagram: "인스타그램", shorts: "유튜브 쇼츠" };

export function PlatformIcon({ platform, className }: { platform: Platform; className?: string }) {
  const Icon = PLATFORM_ICON[platform];
  return <Icon className={cx("size-4", className)} aria-hidden />;
}

export function PlatformTag({ platform }: { platform: Platform }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-subtle px-2 py-1 text-xs font-medium text-ink-2">
      <PlatformIcon platform={platform} className="size-3.5" />
      {labelOf(PLATFORMS, platform)}
    </span>
  );
}

// ---------- Layout bits ----------

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx("rounded-[var(--radius-card)] border border-line bg-surface", className)}>{children}</section>;
}

export function Notice({ tone = "info", icon, title, children, className }: { tone?: "info" | "warning" | "success" | "alert" | "visual"; icon?: ReactNode; title?: ReactNode; children?: ReactNode; className?: string }) {
  const styles = {
    info: "bg-subtle text-ink-2 border-line",
    warning: "bg-unknown-soft text-unknown border-amber-200",
    success: "bg-confirmed-soft text-confirmed border-green-200",
    alert: "bg-alert-soft text-alert border-red-200",
    visual: "bg-visual-soft text-visual border-blue-200",
  };
  return (
    <div className={cx("flex gap-3 rounded-[10px] border px-4 py-3 text-sm", styles[tone], className)} role={tone === "alert" ? "alert" : undefined}>
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cx(!!title && "mt-0.5", "leading-relaxed opacity-90")}>{children}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-line-strong bg-surface px-6 py-14 text-center">
      <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden className="mb-4 text-line-strong">
        <rect x="10" y="8" width="30" height="40" rx="4" stroke="currentColor" strokeWidth="2" />
        <path d="M17 18h16M17 25h16M17 32h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M44 22 34 38l-2 6 6-2 10-14z" fill="#F2664B" opacity=".8" />
      </svg>
      <p className="font-semibold text-ink">{title}</p>
      {body && <p className="mt-1 text-sm text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg viewBox="0 0 64 64" className="size-8 shrink-0" aria-hidden>
        <path d="M14 18v32a4 4 0 0 0 4 4h24a4 4 0 0 0 4-4" fill="none" stroke="#171717" strokeWidth="4" strokeLinecap="round" />
        <path d="M20 12h18" stroke="#171717" strokeWidth="4" strokeLinecap="round" />
        <path d="M38 24 26 40l-2 7 7-2 16-12z" fill="#F2664B" />
        <rect x="41" y="12" width="10" height="10" rx="2" transform="rotate(45 46 17)" fill="#F2664B" />
      </svg>
      {!compact && <span className="text-[22px] font-extrabold tracking-tight text-ink">POSTORY</span>}
    </span>
  );
}

// ---------- Modal ----------

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={cx(
        "m-auto w-[calc(100%-32px)] rounded-[var(--radius-card)] border border-line bg-surface p-0 text-ink-2 shadow-[var(--shadow-overlay)] backdrop:bg-[rgba(23,23,23,0.35)]",
        wide ? "max-w-3xl" : "max-w-lg",
      )}
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <header className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button className="grid size-10 place-items-center rounded-lg text-muted hover:bg-subtle" onClick={onClose} aria-label="닫기">
              <X className="size-5" />
            </button>
          </header>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}

// ---------- Toast ----------

interface ToastItem {
  id: number;
  message: string;
  tone: "info" | "success" | "alert";
}
const ToastContext = createContext<(message: string, tone?: ToastItem["tone"]) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const show = useCallback((message: string, tone: ToastItem["tone"] = "info") => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs, { id, message, tone }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 3500);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4" aria-live="polite">
        {items.map((t) => (
          <div
            key={t.id}
            className={cx(
              "pointer-events-auto max-w-md rounded-[10px] px-4 py-3 text-sm font-medium shadow-[var(--shadow-overlay)]",
              t.tone === "alert" ? "bg-alert text-white" : t.tone === "success" ? "bg-ink text-white" : "bg-ink text-white",
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle className={cx("size-5 animate-spin text-muted", className)} aria-label="불러오는 중" />;
}

export function Field({ label, hint, required, children, aside }: { label: string; hint?: string; required?: boolean; children: ReactNode; aside?: ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-[15px] font-semibold text-ink">
          {label}
          {required && <span className="ml-0.5 text-accent-text">*</span>}
        </span>
        {aside && <span className="text-xs text-muted">{aside}</span>}
      </div>
      {children}
      {hint && <p className="mt-2 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "방금 전";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR");
}
