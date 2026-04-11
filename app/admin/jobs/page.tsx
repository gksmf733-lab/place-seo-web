import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { listJobs, type ScrapeStatus } from "@/lib/jobs";

// 파일 시스템에 접근하는 관리자 뷰 — 동적 렌더
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATUS_LABEL: Record<ScrapeStatus, string> = {
  pending: "대기",
  processing: "처리 중",
  done: "완료",
  failed: "실패",
};

const STATUS_VARIANT: Record<
  ScrapeStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "outline",
  processing: "secondary",
  done: "default",
  failed: "destructive",
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

export default async function AdminJobsPage() {
  const jobs = await listJobs();

  return (
    <main className="flex flex-1 flex-col px-6 py-12">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">접수 목록</h1>
            <p className="text-sm text-muted-foreground">
              총 {jobs.length}건 · 최신순
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

        {jobs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              아직 접수된 건이 없습니다.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <Card key={job.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div className="space-y-1">
                    <CardTitle className="text-base">
                      <Link
                        href={`/admin/jobs/${job.id}`}
                        className="hover:underline underline-offset-4"
                      >
                        {job.placeName}
                      </Link>
                    </CardTitle>
                    <CardDescription>
                      {formatDate(job.createdAt)} · {job.contact}
                    </CardDescription>
                  </div>
                  <Badge variant={STATUS_VARIANT[job.scrapeStatus]}>
                    {STATUS_LABEL[job.scrapeStatus]}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="break-all text-muted-foreground">
                    <span className="font-medium text-foreground">URL:</span>{" "}
                    {job.url}
                  </p>
                  {job.memo && (
                    <p className="text-muted-foreground">
                      <span className="font-medium text-foreground">메모:</span>{" "}
                      {job.memo}
                    </p>
                  )}
                  {job.scrapeStatus === "failed" && job.scrapeError && (
                    <p className="text-destructive">
                      오류: {job.scrapeError}
                    </p>
                  )}
                  <p className="font-mono text-xs text-muted-foreground">
                    #{job.id}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
