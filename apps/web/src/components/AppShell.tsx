import { CalendarDays, Check, CircleHelp, FolderOpen, House, LoaderCircle, Menu, Mic, Plus, Settings, SquarePen, TrendingUp, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { api } from "../lib/api";
import { useLive } from "../lib/hooks";
import { useSaveState } from "../lib/saveState";
import { usageSnapshot } from "../lib/usage";
import { Button, cx, Logo } from "./ui";

function NavItem({ to, icon, label, end, onNavigate }: { to: string; icon: ReactNode; label: string; end?: boolean; onNavigate?: () => void }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cx("flex h-11 items-center gap-3 rounded-[10px] px-3 text-[15px] transition-colors", isActive ? "bg-accent-tint font-semibold text-accent-text" : "text-ink-2 hover:bg-subtle")
      }
    >
      {icon}
      {label}
    </NavLink>
  );
}

function SoonItem({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex h-11 items-center gap-3 px-3 text-[15px] text-muted" aria-disabled>
      {icon}
      <span className="flex-1">{label}</span>
      <span className="rounded-md bg-subtle px-2 py-0.5 text-xs">Soon</span>
    </div>
  );
}

function UsageMeter() {
  const { data } = useLive(usageSnapshot, [], ["events"]);
  if (!data) return null;
  const pct = Math.min(100, (data.monthGenerations / data.monthlyLimit) * 100);
  return (
    <div className="rounded-[10px] border border-line bg-surface p-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-ink-2">이번 달 생성량</span>
        <span className="font-semibold text-accent-text">
          {data.monthGenerations} / {data.monthlyLimit}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-subtle" role="progressbar" aria-valuenow={data.monthGenerations} aria-valuemax={data.monthlyLimit}>
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-6 px-4 py-6">
      <div className="px-2">
        <Logo />
        <p className="mt-1 text-[13px] text-muted">One Story. Every Channel.</p>
      </div>
      <nav className="flex flex-col gap-1" aria-label="주요 메뉴">
        <NavItem to="/" end icon={<House className="size-5" />} label="홈" onNavigate={onNavigate} />
        <NavItem to="/new" icon={<SquarePen className="size-5" />} label="새 스토리 작성" onNavigate={onNavigate} />
        <NavItem to="/library" icon={<FolderOpen className="size-5" />} label="콘텐츠 라이브러리" onNavigate={onNavigate} />
      </nav>
      <div className="border-t border-line pt-5">
        <p className="mb-2 px-3 text-xs font-semibold text-muted">스마트 확장</p>
        <NavItem to="/voice" icon={<Mic className="size-5" />} label="내 보이스 · 브랜드" onNavigate={onNavigate} />
        <SoonItem icon={<CalendarDays className="size-5" />} label="발행 캘린더" />
        <SoonItem icon={<TrendingUp className="size-5" />} label="성과 인사이트" />
      </div>
      <div className="mt-auto flex flex-col gap-2">
        <UsageMeter />
        <NavItem to="/settings" icon={<Settings className="size-5" />} label="설정" onNavigate={onNavigate} />
      </div>
    </div>
  );
}

function SaveIndicator() {
  const state = useSaveState();
  if (state === "idle") return null;
  return (
    <span className="hidden items-center gap-1.5 rounded-full bg-confirmed-soft px-3 py-1 text-xs font-medium text-confirmed sm:inline-flex" aria-live="polite">
      {state === "saving" ? <LoaderCircle className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
      {state === "saving" ? "저장 중" : "자동 저장됨"}
    </span>
  );
}

function ModeBadge() {
  const [mode, setMode] = useState<"openai" | "mock" | "offline" | null>(null);
  useEffect(() => {
    api
      .health()
      .then((h) => setMode(h.mode))
      .catch(() => setMode("offline"));
  }, []);
  if (mode === "mock")
    return (
      <span className="rounded-full bg-unknown-soft px-3 py-1 text-xs font-medium text-unknown" title="OPENAI_API_KEY가 없어 AI 대신 근거 문장을 재배치한 데모 결과를 만듭니다.">
        데모 모드
      </span>
    );
  if (mode === "offline") return <span className="rounded-full bg-alert-soft px-3 py-1 text-xs font-medium text-alert">AI 서버 연결 안 됨</span>;
  return null;
}

export function AppShell() {
  const [drawer, setDrawer] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => setDrawer(false), [location.pathname]);

  return (
    <div className="min-h-dvh lg:pl-[240px]">
      <aside className="fixed inset-y-0 left-0 hidden w-[240px] border-r border-line bg-canvas lg:block">
        <Sidebar />
      </aside>
      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-[rgba(23,23,23,0.35)]" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 w-[260px] bg-canvas shadow-[var(--shadow-overlay)]">
            <button className="absolute right-3 top-3 grid size-10 place-items-center rounded-lg text-muted" onClick={() => setDrawer(false)} aria-label="메뉴 닫기">
              <X className="size-5" />
            </button>
            <Sidebar onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-canvas/90 px-4 backdrop-blur lg:px-8">
        <button className="grid size-10 place-items-center rounded-lg lg:hidden" onClick={() => setDrawer(true)} aria-label="메뉴 열기">
          <Menu className="size-5" />
        </button>
        <span className="lg:hidden">
          <Logo compact />
        </span>
        <div className="ml-auto flex items-center gap-2">
          <SaveIndicator />
          <ModeBadge />
          <button onClick={() => navigate("/settings#help")} className="hidden size-10 place-items-center rounded-lg text-muted hover:bg-subtle sm:grid" aria-label="도움말">
            <CircleHelp className="size-5" />
          </button>
          <Button variant="primary" size="sm" icon={<Plus className="size-4" />} onClick={() => navigate("/new")}>
            <span className="hidden sm:inline">새 콘텐츠 만들기</span>
            <span className="sm:hidden">새로 만들기</span>
          </Button>
        </div>
      </header>
      <main className="px-4 pb-24 pt-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
