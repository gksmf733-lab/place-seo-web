"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { ScrapeStatus } from "@/lib/jobs";

type JobItem = {
  id: string;
  placeName: string;
  scrapeStatus: ScrapeStatus;
  createdAt: string;
  contact: string;
  placeId?: string;
  url: string;
  memo?: string;
  scrapeError?: string;
};

const STATUS_CONF: Record<
  ScrapeStatus,
  { label: string; bg: string; text: string; dot: string }
> = {
  pending: {
    label: "대기",
    bg: "bg-[var(--naver-gray-100)]",
    text: "text-[var(--naver-gray-500)]",
    dot: "bg-[var(--naver-gray-500)]",
  },
  processing: {
    label: "처리 중",
    bg: "bg-amber-50",
    text: "text-[var(--naver-amber)]",
    dot: "bg-[var(--naver-amber)]",
  },
  done: {
    label: "완료",
    bg: "bg-[var(--naver-green-50)]",
    text: "text-[var(--naver-green-dark)]",
    dot: "bg-[var(--naver-green)]",
  },
  failed: {
    label: "실패",
    bg: "bg-red-50",
    text: "text-[var(--naver-red)]",
    dot: "bg-[var(--naver-red)]",
  },
};

const STATUS_BORDER: Record<ScrapeStatus, string> = {
  pending: "border-l-[var(--naver-gray-200)]",
  processing: "border-l-[var(--naver-amber)]",
  done: "border-l-[var(--naver-green)]",
  failed: "border-l-[var(--naver-red)]",
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function StatusBadge({ status }: { status: ScrapeStatus }) {
  const c = STATUS_CONF[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${c.bg} ${c.text}`}
    >
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

function InfoCell({
  label,
  value,
  mono,
  truncate,
}: {
  label: string;
  value: string;
  mono?: boolean;
  truncate?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span
        className="shrink-0 text-[0.7rem] font-semibold"
        style={{ color: "var(--naver-gray-500)" }}
      >
        {label}
      </span>
      <span
        className={`${mono ? "font-mono" : ""} ${truncate ? "truncate" : ""}`}
        style={{ color: "var(--naver-gray-900)" }}
      >
        {value}
      </span>
    </div>
  );
}

export function JobListClient({ jobs }: { jobs: JobItem[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  const allSelected = jobs.length > 0 && selected.size === jobs.length;

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(jobs.map((j) => j.id)));
    }
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`선택한 ${selected.size}건을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) return;

    setDeleting(true);
    try {
      const res = await fetch("/api/jobs", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as Record<string, string>).error || "삭제 실패");
      }

      const result = await res.json();
      toast.success(`${result.deleted}건 삭제 완료`);
      setSelected(new Set());
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "삭제 중 오류 발생");
    } finally {
      setDeleting(false);
    }
  };

  if (jobs.length === 0) {
    return (
      <div className="rounded-xl bg-white px-6 py-16 text-center shadow-sm ring-1 ring-[var(--naver-gray-200)]">
        <p style={{ color: "var(--naver-gray-500)" }}>
          아직 접수된 건이 없습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* 툴바 */}
      <div className="flex items-center justify-between rounded-lg bg-white px-4 py-2.5 shadow-sm ring-1 ring-[var(--naver-gray-200)]">
        <label className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: "var(--naver-gray-700)" }}>
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            className="h-4 w-4 rounded border-gray-300 accent-[var(--naver-green)]"
          />
          전체 선택 ({selected.size}/{jobs.length})
        </label>
        {selected.size > 0 && (
          <Button
            onClick={handleDelete}
            variant="outline"
            size="sm"
            disabled={deleting}
            className="text-red-600 border-red-200 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            {deleting ? "삭제 중..." : `${selected.size}건 삭제`}
          </Button>
        )}
      </div>

      {/* 목록 */}
      {jobs.map((job) => (
        <div key={job.id} className="group flex items-stretch">
          {/* 체크박스 */}
          <div
            className={`flex items-center px-3 rounded-l-xl bg-white ring-1 ring-[var(--naver-gray-200)] border-l-4 ${STATUS_BORDER[job.scrapeStatus]}`}
          >
            <input
              type="checkbox"
              checked={selected.has(job.id)}
              onChange={() => toggle(job.id)}
              className="h-4 w-4 rounded border-gray-300 accent-[var(--naver-green)] cursor-pointer"
            />
          </div>

          {/* 카드 */}
          <Link
            href={`/admin/jobs/${job.id}`}
            className="flex-1 block"
          >
            <div className="overflow-hidden rounded-r-xl bg-white shadow-sm ring-1 ring-[var(--naver-gray-200)] transition-all hover:shadow-md hover:ring-[var(--naver-green)]/40">
              <div className="px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <h2
                    className="truncate text-[0.95rem] font-bold group-hover:text-[var(--naver-green-dark)]"
                    style={{ color: "var(--naver-gray-900)" }}
                  >
                    {job.placeName}
                  </h2>
                  <StatusBadge status={job.scrapeStatus} />
                </div>

                <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 text-[0.8rem] sm:grid-cols-3">
                  <InfoCell label="접수" value={formatDate(job.createdAt)} />
                  <InfoCell label="연락처" value={job.contact} />
                  <InfoCell label="Place ID" value={job.placeId || "-"} mono />
                </div>

                {job.url && (
                  <div className="mt-2">
                    <InfoCell label="URL" value={job.url} truncate />
                  </div>
                )}

                {job.memo && (
                  <div
                    className="mt-2 rounded-md px-3 py-2 text-xs"
                    style={{ backgroundColor: "var(--naver-green-50)", color: "var(--naver-green-dark)" }}
                  >
                    <span className="font-semibold">메모: </span>
                    {job.memo}
                  </div>
                )}

                {job.scrapeStatus === "failed" && job.scrapeError && (
                  <div className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-[var(--naver-red)]">
                    <span className="font-semibold">오류: </span>
                    {job.scrapeError}
                  </div>
                )}
              </div>
            </div>
          </Link>
        </div>
      ))}
    </div>
  );
}
