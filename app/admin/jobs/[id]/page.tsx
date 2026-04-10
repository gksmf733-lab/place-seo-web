import { promises as fs } from "node:fs";
import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { readJob, type ScrapeStatus } from "@/lib/jobs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PageProps = {
  params: Promise<{ id: string }>;
};

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

function formatDate(iso?: string): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("ko-KR");
  } catch {
    return iso;
  }
}

async function readFileIfExists(relPath?: string): Promise<string | null> {
  if (!relPath) return null;
  try {
    return await fs.readFile(path.join(process.cwd(), relPath), "utf8");
  } catch {
    return null;
  }
}

export default async function AdminJobDetailPage({ params }: PageProps) {
  const { id } = await params;
  const job = await readJob(id);
  if (!job) notFound();

  const worksheet = await readFileIfExists(job.worksheetPath);

  return (
    <main className="flex flex-1 flex-col px-6 py-12">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">
              {job.placeName}
            </h1>
            <p className="font-mono text-xs text-muted-foreground">#{job.id}</p>
          </div>
          <Badge variant={STATUS_VARIANT[job.scrapeStatus]}>
            {STATUS_LABEL[job.scrapeStatus]}
          </Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>접수 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="grid grid-cols-[8rem_1fr] gap-y-2">
              <span className="text-muted-foreground">접수 시각</span>
              <span>{formatDate(job.createdAt)}</span>
              <span className="text-muted-foreground">URL</span>
              <span className="break-all">{job.url}</span>
              <span className="text-muted-foreground">연락처</span>
              <span>{job.contact}</span>
              {job.memo && (
                <>
                  <span className="text-muted-foreground">메모</span>
                  <span className="whitespace-pre-wrap">{job.memo}</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>스크래핑 상태</CardTitle>
            <CardDescription>
              Playwright로 네이버 플레이스 정보를 추출한 결과입니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="grid grid-cols-[8rem_1fr] gap-y-2">
              <span className="text-muted-foreground">상태</span>
              <span>{STATUS_LABEL[job.scrapeStatus]}</span>
              <span className="text-muted-foreground">시작</span>
              <span>{formatDate(job.scrapeStartedAt)}</span>
              <span className="text-muted-foreground">완료</span>
              <span>{formatDate(job.scrapeFinishedAt)}</span>
              {job.placeId && (
                <>
                  <span className="text-muted-foreground">Place ID</span>
                  <span className="font-mono">{job.placeId}</span>
                </>
              )}
              {job.scrapeError && (
                <>
                  <span className="text-muted-foreground">오류</span>
                  <span className="text-destructive break-all">
                    {job.scrapeError}
                  </span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {worksheet && (
          <Card>
            <CardHeader>
              <CardTitle>작업지</CardTitle>
              <CardDescription>
                섹션별 프롬프트를 복사해서 Antigravity/Claude에 붙여넣으세요.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="max-h-[60vh] overflow-auto rounded-md border bg-muted/40 p-4 text-xs whitespace-pre-wrap break-words">
                {worksheet}
              </pre>
            </CardContent>
          </Card>
        )}

        <div className="flex items-center gap-2">
          <Button
            render={<Link href="/admin/jobs" />}
            variant="outline"
            size="lg"
          >
            ← 목록으로
          </Button>
        </div>
      </div>
    </main>
  );
}
