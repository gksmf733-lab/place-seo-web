import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listJobs, type ScrapeStatus } from "@/lib/jobs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

export default async function AdminJobsPage() {
  const jobs = await listJobs();

  const counts = {
    total: jobs.length,
    done: jobs.filter((j) => j.scrapeStatus === "done").length,
    processing: jobs.filter((j) => j.scrapeStatus === "processing").length,
    failed: jobs.filter((j) => j.scrapeStatus === "failed").length,
  };

  return (
    <main className="flex flex-1 flex-col bg-[var(--naver-gray-50)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        {/* ── 헤더 ── */}
        <div className="rounded-xl bg-white px-6 py-5 shadow-sm ring-1 ring-[var(--naver-gray-200)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1
                className="text-xl font-bold tracking-tight"
                style={{ color: "var(--naver-gray-900)" }}
              >
                접수 목록
              </h1>
              <p className="mt-1 text-sm" style={{ color: "var(--naver-gray-500)" }}>
                네이버 플레이스 최적화 작업 관리
              </p>
            </div>
            <Button
              render={<Link href="/admin/prompts" />}
              variant="outline"
              size="sm"
            >
              프롬프트 관리
            </Button>
          </div>

          {/* ── 통계 ── */}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="전체" value={counts.total} color="var(--naver-green)" />
            <StatCard label="완료" value={counts.done} color="var(--naver-green)" />
            <StatCard label="처리 중" value={counts.processing} color="var(--naver-amber)" />
            <StatCard label="실패" value={counts.failed} color="var(--naver-red)" />
          </div>
        </div>

        {/* ── 목록 ── */}
        {jobs.length === 0 ? (
          <div className="rounded-xl bg-white px-6 py-16 text-center shadow-sm ring-1 ring-[var(--naver-gray-200)]">
            <p style={{ color: "var(--naver-gray-500)" }}>
              아직 접수된 건이 없습니다.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {jobs.map((job) => (
              <Link
                key={job.id}
                href={`/admin/jobs/${job.id}`}
                className="group block"
              >
                <div
                  className={`overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-[var(--naver-gray-200)] transition-all hover:shadow-md hover:ring-[var(--naver-green)]/40 border-l-4 ${STATUS_BORDER[job.scrapeStatus]}`}
                >
                  <div className="px-5 py-4">
                    {/* 상단: 업체명 + 상태 */}
                    <div className="flex items-center justify-between gap-3">
                      <h2
                        className="truncate text-[0.95rem] font-bold group-hover:text-[var(--naver-green-dark)]"
                        style={{ color: "var(--naver-gray-900)" }}
                      >
                        {job.placeName}
                      </h2>
                      <StatusBadge status={job.scrapeStatus} />
                    </div>

                    {/* 하단: 정보 그리드 */}
                    <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 text-[0.8rem] sm:grid-cols-3">
                      <InfoCell label="접수" value={formatDate(job.createdAt)} />
                      <InfoCell label="연락처" value={job.contact} />
                      <InfoCell
                        label="Place ID"
                        value={job.placeId || "-"}
                        mono
                      />
                    </div>

                    {job.url && (
                      <div className="mt-2">
                        <InfoCell
                          label="URL"
                          value={job.url}
                          truncate
                        />
                      </div>
                    )}

                    {job.memo && (
                      <div className="mt-2 rounded-md px-3 py-2 text-xs" style={{ backgroundColor: "var(--naver-green-50)", color: "var(--naver-green-dark)" }}>
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
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div
      className="rounded-lg px-4 py-3"
      style={{ backgroundColor: "var(--naver-gray-50)" }}
    >
      <p className="text-xs font-medium" style={{ color: "var(--naver-gray-500)" }}>
        {label}
      </p>
      <p className="mt-0.5 text-lg font-bold" style={{ color }}>
        {value}
      </p>
    </div>
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
