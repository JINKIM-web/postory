import { DatabaseBackup, Download, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { BackupError, backupFileName, exportBackup, importBackup, readBackup } from "../lib/backup";
import { downloadBlob } from "../lib/export";
import { useSettings } from "../lib/settings";
import { Button, cx, Modal, Notice, relativeTime, useToast } from "./ui";

// 전체 백업 다운로드 / 백업 불러오기 (설정 화면)

export async function downloadFullBackup(toast: ReturnType<typeof useToast>) {
  try {
    const { blob, manifest } = await exportBackup();
    downloadBlob(blob, backupFileName("all"));
    toast(`백업했습니다 (프로젝트 ${manifest.counts.projects ?? 0}개, 사진 ${manifest.counts.images ?? 0}장).`, "success");
  } catch (err) {
    toast(err instanceof Error ? err.message : "백업하지 못했습니다.", "alert");
  }
}

export function BackupControls() {
  const toast = useToast();
  const settings = useSettings();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"export" | "import" | null>(null);
  const [pending, setPending] = useState<{ file: File; scope: string; counts: string } | null>(null);
  const [mode, setMode] = useState<"merge" | "replace">("merge");

  async function pick(file: File) {
    try {
      const { manifest } = await readBackup(file);
      const c = manifest.counts;
      setPending({
        file,
        scope: manifest.scope === "all" ? "전체 백업" : "프로젝트 1개",
        counts: `프로젝트 ${c.projects ?? 0}개 · 사진 ${c.images ?? 0}장 · 버전 ${c.versions ?? 0}개 · ${new Date(manifest.exportedAt).toLocaleString("ko-KR")} 백업`,
      });
      setMode("merge");
    } catch (err) {
      toast(err instanceof BackupError ? err.message : "백업 파일을 읽지 못했습니다.", "alert");
    }
  }

  async function confirmImport() {
    if (!pending) return;
    if (mode === "replace" && !window.confirm("지금 이 브라우저에 있는 모든 데이터를 지우고 백업으로 바꿉니다. 계속할까요?")) return;
    setBusy("import");
    try {
      const { imported } = await importBackup(pending.file, mode);
      toast(`불러왔습니다 (레코드 ${imported}개).`, "success");
      setPending(null);
    } catch (err) {
      toast(err instanceof Error ? err.message : "불러오지 못했습니다.", "alert");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-2">
        마지막 전체 백업: <strong>{settings.lastBackupAt ? relativeTime(settings.lastBackupAt) : "없음"}</strong>
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="primary"
          icon={<Download className="size-4" />}
          loading={busy === "export"}
          onClick={async () => {
            setBusy("export");
            await downloadFullBackup(toast);
            setBusy(null);
          }}
        >
          전체 백업 다운로드
        </Button>
        <Button size="sm" icon={<Upload className="size-4" />} onClick={() => input.current?.click()}>
          백업 불러오기
        </Button>
        <input
          ref={input}
          type="file"
          accept=".zip,application/zip"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void pick(f);
            e.target.value = "";
          }}
        />
      </div>
      <p className="text-xs text-muted">사진·버전·개인화·설정이 ZIP 하나에 담깁니다. 다른 브라우저나 PC에서 불러오면 그대로 이어서 쓸 수 있습니다.</p>

      <Modal
        open={!!pending}
        onClose={() => setPending(null)}
        title="백업 불러오기"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPending(null)}>
              취소
            </Button>
            <Button variant={mode === "replace" ? "danger" : "primary"} loading={busy === "import"} icon={<DatabaseBackup className="size-4" />} onClick={confirmImport}>
              {mode === "replace" ? "모두 바꾸기" : "합치기"}
            </Button>
          </>
        }
      >
        {pending && (
          <div className="space-y-4">
            <Notice tone="info" title={pending.scope}>
              {pending.counts}
            </Notice>
            {(
              [
                ["merge", "합치기 (권장)", "지금 데이터는 그대로 두고 백업을 더합니다. 같은 프로젝트가 있으면 백업 내용으로 바뀝니다."],
                ["replace", "모두 바꾸기", "지금 이 브라우저의 데이터를 모두 지우고 백업 상태로 되돌립니다."],
              ] as const
            ).map(([v, title, desc]) => (
              <label key={v} className={cx("flex cursor-pointer gap-3 rounded-[10px] border p-3.5", mode === v ? (v === "replace" ? "border-alert bg-alert-soft/50" : "border-accent bg-accent-tint/60") : "border-line")}>
                <input type="radio" name="import-mode" className="mt-1 accent-[var(--color-accent)]" checked={mode === v} onChange={() => setMode(v)} />
                <span>
                  <span className="font-semibold text-ink">{title}</span>
                  <span className="mt-0.5 block text-[13px] text-muted">{desc}</span>
                </span>
              </label>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
