import Link from "next/link";

import { Button } from "@/components/ui/button";
import { listJobs, type ScrapeStatus } from "@/lib/jobs";
import { JobListClient } from "@/components/job-list-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

        {/* ── 목록 (클라이언트 컴포넌트) ── */}
        <JobListClient jobs={jobs} />
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
