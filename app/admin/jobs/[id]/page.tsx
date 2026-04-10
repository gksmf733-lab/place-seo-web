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
import { CopyButton } from "@/components/copy-button";
import { readJob, type ScrapeStatus } from "@/lib/jobs";
import { loadSections } from "@/lib/sections";
import { buildSectionViews } from "@/lib/worksheet";
import type { ScrapedPlace } from "@/lib/scraper/types";

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

async function readScrapedPlace(
  relPath?: string,
): Promise<ScrapedPlace | null> {
  if (!relPath) return null;
  try {
    const raw = await fs.readFile(
      path.join(process.cwd(), relPath),
      "utf8",
    );
    return JSON.parse(raw) as ScrapedPlace;
  } catch {
    return null;
  }
}

function formatRating(data: ScrapedPlace): string {
  if (data.rating && data.visitorReviews) {
    return `${data.rating}점 · 방문자 ${data.visitorReviews} · 블로그 ${data.blogReviews}`;
  }
  if (data.visitorReviews) {
    return `방문자 ${data.visitorReviews} · 블로그 ${data.blogReviews} (별점 미집계)`;
  }
  return "";
}

export default async function AdminJobDetailPage({ params }: PageProps) {
  const { id } = await params;
  const job = await readJob(id);
  if (!job) notFound();

  const scraped =
    job.scrapeStatus === "done"
      ? await readScrapedPlace(job.scrapePath)
      : null;
  const sections = scraped ? await loadSections() : [];
  const sectionViews =
    scraped && sections.length > 0
      ? buildSectionViews(scraped, sections)
      : [];

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

        {scraped ? (
          <Card>
            <CardHeader>
              <CardTitle>추출된 플레이스 정보</CardTitle>
              <CardDescription>
                섹션 프롬프트에 이 정보가 그대로 주입됩니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="grid grid-cols-[8rem_1fr] gap-y-2">
                <span className="text-muted-foreground">업체명</span>
                <span>{scraped.name || "-"}</span>
                <span className="text-muted-foreground">카테고리</span>
                <span>{scraped.category || "-"}</span>
                <span className="text-muted-foreground">주소</span>
                <span>{scraped.address || "-"}</span>
                <span className="text-muted-foreground">전화</span>
                <span>{scraped.phone || "-"}</span>
                <span className="text-muted-foreground">영업시간</span>
                <span>{scraped.hours || "-"}</span>
                <span className="text-muted-foreground">홈페이지</span>
                <span className="break-all">{scraped.homepage || "-"}</span>
                <span className="text-muted-foreground">편의시설</span>
                <span>{scraped.amenities || "-"}</span>
                <span className="text-muted-foreground">별점/리뷰</span>
                <span>{formatRating(scraped) || "-"}</span>
                {scraped.description && (
                  <>
                    <span className="text-muted-foreground">AI 브리핑</span>
                    <span className="whitespace-pre-wrap">
                      {scraped.description}
                    </span>
                  </>
                )}
              </div>

              {scraped.menuItems.length > 0 && (
                <div className="pt-2">
                  <p className="text-muted-foreground mb-2">메뉴</p>
                  <ul className="list-disc space-y-0.5 pl-5">
                    {scraped.menuItems.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        ) : job.scrapeStatus === "done" ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              스크래핑 결과 파일을 찾을 수 없습니다. (`{job.scrapePath}`)
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              작업지 생성 대기 중입니다. 잠시 후 새로고침해 주세요.
            </CardContent>
          </Card>
        )}

        {sectionViews.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-xl font-bold tracking-tight">섹션별 작업지</h2>
            <p className="text-sm text-muted-foreground">
              각 프롬프트를 복사해서 Antigravity / Claude 채팅창에 붙여넣으세요.
            </p>
          </div>
        )}

        {sectionViews.map((sv) => (
          <Card key={sv.order}>
            <CardHeader>
              <CardTitle>
                섹션 {sv.order}. {sv.name}
              </CardTitle>
              {sv.description && (
                <CardDescription>{sv.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {sv.guide && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    작성 가이드
                  </p>
                  <div className="rounded-md border bg-muted/40 px-4 py-3 text-sm whitespace-pre-wrap">
                    {sv.guide}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">
                    프롬프트 (치환 완료)
                  </p>
                  <CopyButton text={sv.prompt} />
                </div>
                <pre className="max-h-80 overflow-auto rounded-md border bg-muted/40 px-4 py-3 text-xs whitespace-pre-wrap break-words">
                  {sv.prompt}
                </pre>
              </div>
            </CardContent>
          </Card>
        ))}

        {scraped && sectionViews.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              data/sections/ 폴더에 YAML 템플릿이 없습니다.
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
