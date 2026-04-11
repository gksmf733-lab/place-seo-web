import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";

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
import { listPrompts, type Prompt } from "@/lib/prompts";
import { buildSectionViews } from "@/lib/worksheet";
import type { Section } from "@/lib/sections";
import type { ScrapedPlace } from "@/lib/scraper/types";
import { ExcelDownloadButton } from "@/components/excel-download-button";
import { ReviewsTable } from "@/components/reviews-table";
import { RescrapeButton } from "@/components/rescrape-button";
import { PromptPicker } from "@/components/prompt-picker";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const SECTION_TYPE_ORDER = ["intro", "keywords", "menu"] as const;

type SelectedSection = {
  sectionType: string;
  selectedId: string;
  options: Prompt[];
  section: Section;
};

function resolveSelectedSections(
  allPrompts: Prompt[],
  sp: Record<string, string | string[] | undefined>,
): SelectedSection[] {
  const bySection = new Map<string, Prompt[]>();
  for (const p of allPrompts) {
    const arr = bySection.get(p.sectionType) ?? [];
    arr.push(p);
    bySection.set(p.sectionType, arr);
  }
  const orderedTypes = [
    ...SECTION_TYPE_ORDER.filter((s) => bySection.has(s)),
    ...Array.from(bySection.keys())
      .filter((s) => !SECTION_TYPE_ORDER.includes(s as typeof SECTION_TYPE_ORDER[number]))
      .sort(),
  ];

  const result: SelectedSection[] = [];
  for (const sectionType of orderedTypes) {
    const options = bySection.get(sectionType) ?? [];
    if (options.length === 0) continue;
    const rawParam = sp[sectionType];
    const preferredId = typeof rawParam === "string" ? rawParam : undefined;
    const selected =
      (preferredId ? options.find((p) => p.id === preferredId) : undefined) ??
      options.find((p) => p.isDefault) ??
      options[0];
    if (!selected) continue;
    result.push({
      sectionType,
      selectedId: selected.id,
      options,
      section: {
        name: selected.name,
        description: selected.description,
        guide: selected.guide,
        prompt: selected.promptTemplate,
        order: selected.sortOrder || result.length + 1,
      },
    });
  }
  return result;
}

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

function formatRating(data: ScrapedPlace): string {
  if (data.rating && data.visitorReviews) {
    return `${data.rating}점 · 방문자 ${data.visitorReviews} · 블로그 ${data.blogReviews}`;
  }
  if (data.visitorReviews) {
    return `방문자 ${data.visitorReviews} · 블로그 ${data.blogReviews} (별점 미집계)`;
  }
  return "";
}

export default async function AdminJobDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const job = await readJob(id);
  if (!job) notFound();

  const scraped = job.scrapedData as ScrapedPlace | null;

  // IA CANVAS 커스텀 API 노드에 붙여넣을 절대 URL 계산
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const canvasApiUrl = host ? `${proto}://${host}/api/canvas/place/${job.id}` : `/api/canvas/place/${job.id}`;

  // DB에서 프롬프트 라이브러리 로드 후, 쿼리 파라미터에 따라 섹션별 선택 결정
  const allPrompts = await listPrompts();
  const selectedSections = resolveSelectedSections(allPrompts, sp);
  const sections = selectedSections.map((s) => s.section);
  const sectionViews = buildSectionViews(scraped, sections);

  return (
    <main className="flex flex-1 flex-col px-6 py-12">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">
              {job.placeName}
            </h1>
            <p className="font-mono text-xs text-muted-foreground">#{job.id}</p>
          </div>
          <div className="flex items-center gap-2">
            <RescrapeButton jobId={job.id} />
            <Badge variant={STATUS_VARIANT[job.scrapeStatus]}>
              {STATUS_LABEL[job.scrapeStatus]}
            </Badge>
          </div>
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
            <CardTitle>스크래핑(DB 저장) 상태</CardTitle>
            <CardDescription>
              정보 추출 및 데이터베이스 저장 상태입니다.
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

        <Card>
          <CardHeader>
            <CardTitle>IA CANVAS 연동</CardTitle>
            <CardDescription>
              IA CANVAS의 <strong>커스텀 API 노드</strong>에 아래 URL을 붙여넣으면
              이 업체의 Place ID·URL·스크래핑 결과가 JSON으로 자동 송출됩니다.
              (Method: GET, JSON→CSV 자동 변환 ON 권장)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-[8rem_1fr] gap-y-2 items-start">
              <span className="text-muted-foreground pt-1">엔드포인트</span>
              <div className="flex items-start gap-2">
                <code className="flex-1 break-all rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs">
                  {canvasApiUrl}
                </code>
                <CopyButton text={canvasApiUrl} label="URL 복사" />
              </div>
              <span className="text-muted-foreground pt-1">Method</span>
              <span className="font-mono">GET</span>
              <span className="text-muted-foreground pt-1">반환 Place ID</span>
              <span className="font-mono">
                {job.placeId || scraped?.placeId || "(스크래핑 대기 중)"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              반환 필드: jobId, placeId, placeName, url, scrapedUrl, name, category,
              address, phone, hours, homepage, amenities, rating, visitorReviews,
              blogReviews, description 등.
            </p>
          </CardContent>
        </Card>

        {scraped ? (
          <Card>
            <CardHeader>
              <CardTitle>추출된 플레이스 정보</CardTitle>
              <CardDescription>
                섹션 프롬프트 작성의 기반이 되는 데이터입니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="grid grid-cols-[8rem_1fr] gap-y-2">
                <span className="text-muted-foreground">Place ID</span>
                <span className="font-mono flex items-center gap-2">
                  {scraped.placeId || job.placeId || "-"}
                  {(scraped.placeId || job.placeId) && (
                    <CopyButton
                      text={scraped.placeId || job.placeId || ""}
                      label="ID 복사"
                    />
                  )}
                </span>
                <span className="text-muted-foreground">플레이스 URL</span>
                <span className="break-all flex items-start gap-2">
                  <a
                    href={scraped.inputUrl || job.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 hover:text-primary"
                  >
                    {scraped.inputUrl || job.url}
                  </a>
                  <CopyButton text={scraped.inputUrl || job.url} label="URL 복사" />
                </span>
                {scraped.scrapedUrl && scraped.scrapedUrl !== (scraped.inputUrl || job.url) && (
                  <>
                    <span className="text-muted-foreground">스크래핑 URL</span>
                    <span className="break-all">
                      <a
                        href={scraped.scrapedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-2 hover:text-primary"
                      >
                        {scraped.scrapedUrl}
                      </a>
                    </span>
                  </>
                )}
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

              {scraped.menuItems && scraped.menuItems.length > 0 && (
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
              DB에 스크래핑된 상세 정보가 없습니다.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              작업지 생성 대기 중입니다. 잠시 후 새로고침해 주세요.
            </CardContent>
          </Card>
        )}

        {/* AI Canvas에서 넘어온 리뷰 데이터 패널 */}
        {(() => {
          // 데이터 전처리: 글자면 파싱하고, 배열이 아니면 배열로 감싸서 무조건 표로 만듦
          let displayReviews = job.reviewsData;
          try {
            if (typeof displayReviews === "string") {
              displayReviews = JSON.parse(displayReviews);
            }
            if (displayReviews && !Array.isArray(displayReviews)) {
              displayReviews = [displayReviews];
            }
          } catch (e) {
            console.error("Review parsing error:", e);
          }

          if (
            !displayReviews ||
            (Array.isArray(displayReviews) && displayReviews.length === 0)
          ) {
            if (!job.placeId) return null;
            return (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  AI Canvas에서 접수된 리뷰(분석) 결과가 없습니다.
                  <br />
                  현재 Place ID: <strong>{job.placeId}</strong>
                </CardContent>
              </Card>
            );
          }

          return (
            <Card>
              <CardHeader className="flex flex-row items-start sm:items-center justify-between pb-4 gap-4">
                <div className="space-y-1">
                  <CardTitle>AI Canvas 수집 리뷰 ({displayReviews.length}건)</CardTitle>
                  <CardDescription>
                    AI Canvas를 통해 수집된 상세 데이터입니다. 드래그 복사 및 엑셀 저장이 가능합니다.
                  </CardDescription>
                  {job.placeId && (
                    <p className="text-xs text-muted-foreground pt-1">
                      송출된 Place ID: <span className="font-mono">{job.placeId}</span>
                    </p>
                  )}
                </div>
                <ExcelDownloadButton data={displayReviews} fileName={`${job.placeName || "업체"}_리브데이터.csv`} />
              </CardHeader>
              <CardContent>
                <ReviewsTable reviews={displayReviews} />
              </CardContent>
            </Card>
          );
        })()}

        {sectionViews.length > 0 && (
          <div className="space-y-2 pt-4">
            <h2 className="text-xl font-bold tracking-tight">섹션별 작업지</h2>
            <p className="text-sm text-muted-foreground">
              각 프롬프트를 복사해서 Antigravity / Claude 채팅창에 붙여넣으세요.
            </p>
            {!scraped && (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                ⚠ 스크래핑 결과가 없어 프롬프트에 실제 데이터 대신 placeholder가
                들어가 있습니다. 상단 <strong>&quot;스크래핑 재실행&quot;</strong>{" "}
                버튼으로 다시 시도해 주세요.
              </div>
            )}
          </div>
        )}

        {sectionViews.map((sv, i) => {
          const meta = selectedSections[i];
          return (
            <Card key={`${meta.sectionType}-${sv.order}`}>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div className="space-y-1">
                  <CardTitle>
                    섹션 {sv.order}. {sv.name}
                  </CardTitle>
                  {sv.description && (
                    <CardDescription>{sv.description}</CardDescription>
                  )}
                </div>
                <PromptPicker
                  sectionType={meta.sectionType}
                  options={meta.options.map((o) => ({
                    id: o.id,
                    name: o.name,
                    isDefault: o.isDefault,
                  }))}
                  selectedId={meta.selectedId}
                />
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
                    <CopyButton text={sv.prompt} label="프롬프트 복사" />
                  </div>
                  <pre className="max-h-80 overflow-auto rounded-md border bg-muted/40 px-4 py-3 text-xs whitespace-pre-wrap break-words">
                    {sv.prompt}
                  </pre>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {allPrompts.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-8 text-center text-sm text-muted-foreground">
              <p>프롬프트 라이브러리가 비어 있습니다.</p>
              <Button
                render={<Link href="/admin/prompts" />}
                variant="outline"
                size="sm"
              >
                프롬프트 관리 페이지로 이동
              </Button>
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
