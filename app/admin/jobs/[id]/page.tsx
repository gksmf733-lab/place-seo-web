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
import type { ScrapedPlace, MenuItem } from "@/lib/scraper/types";
import { ExcelDownloadButton } from "@/components/excel-download-button";
import { ReviewsTable } from "@/components/reviews-table";
import { RescrapeButton } from "@/components/rescrape-button";
import { PromptPicker } from "@/components/prompt-picker";
import { ReviewAnalysisPanel } from "@/components/review-analysis-panel";
import { ReviewIntroPanel } from "@/components/review-intro-panel";
import { OwnerIntroPanel } from "@/components/owner-intro-panel";
import { ProbePanel } from "@/components/probe-panel";
import { MenuEvaluationPanel } from "@/components/menu-evaluation-panel";

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
  const canvasJobsUrl = host ? `${proto}://${host}/api/canvas/jobs` : `/api/canvas/jobs`;
  const canvasJobsPeekUrl = `${canvasJobsUrl}?peek=1`;

  // DB에서 프롬프트 라이브러리 로드 후, 쿼리 파라미터에 따라 섹션별 선택 결정
  const allPrompts = await listPrompts();
  const selectedSections = resolveSelectedSections(allPrompts, sp);
  const sections = selectedSections.map((s) => s.section);
  const sectionViews = buildSectionViews(scraped, sections);

  return (
    <main className="flex flex-1 flex-col bg-[var(--naver-gray-50)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-4xl space-y-5">
        {/* ── 네비게이션 ── */}
        <Button
          render={<Link href="/admin/jobs" />}
          variant="outline"
          size="sm"
          className="self-start"
        >
          ← 접수 목록으로
        </Button>

        {/* ── 업체 헤더 ── */}
        <div
          className="overflow-hidden rounded-xl shadow-sm ring-1 ring-[var(--naver-gray-200)]"
          style={{ borderTop: "3px solid var(--naver-green)" }}
        >
          <div className="bg-white px-6 py-5">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <h1
                  className="text-xl font-bold tracking-tight"
                  style={{ color: "var(--naver-gray-900)" }}
                >
                  {job.placeName}
                </h1>
                <p className="font-mono text-xs" style={{ color: "var(--naver-gray-500)" }}>
                  #{job.id}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <RescrapeButton jobId={job.id} />
                <Badge variant={STATUS_VARIANT[job.scrapeStatus]}>
                  {STATUS_LABEL[job.scrapeStatus]}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* ── 접수 정보 + 스크래핑 상태 — 2열 ── */}
        <div className="grid gap-4 md:grid-cols-2">
          <SectionCard title="접수 정보" accentColor="var(--naver-green)">
            <InfoGrid>
              <InfoRow label="접수 시각" value={formatDate(job.createdAt)} />
              <InfoRow label="URL" value={job.url} breakAll />
              <InfoRow label="연락처" value={job.contact} />
              {job.memo && <InfoRow label="메모" value={job.memo} preWrap />}
            </InfoGrid>
          </SectionCard>

          <SectionCard title="스크래핑 상태" accentColor="var(--naver-blue)">
            <InfoGrid>
              <InfoRow label="상태" value={STATUS_LABEL[job.scrapeStatus]} />
              <InfoRow label="시작" value={formatDate(job.scrapeStartedAt)} />
              <InfoRow label="완료" value={formatDate(job.scrapeFinishedAt)} />
              {job.placeId && <InfoRow label="Place ID" value={job.placeId} mono />}
              {job.scrapeError && (
                <InfoRow label="오류" value={job.scrapeError} error />
              )}
            </InfoGrid>
          </SectionCard>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>AI Canvas 연동 (Pull 모델)</CardTitle>
            <CardDescription>
              AI Canvas의 <strong>커스텀 API 노드(단일 요청, GET)</strong>에 아래
              <strong> 목록 URL</strong>을 붙여넣고, 스케줄 탭에서 <strong>매분</strong>
              주기로 등록하면 신규 업체가 자동으로 AI Canvas에 송출됩니다.
              한 번 송출된 job은 다시 포함되지 않습니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">
                ① 목록 엔드포인트 (커스텀 API 노드에 입력)
              </p>
              <div className="flex items-start gap-2">
                <code className="flex-1 break-all rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs">
                  {canvasJobsUrl}
                </code>
                <CopyButton text={canvasJobsUrl} label="URL 복사" />
              </div>
              <p className="text-xs text-muted-foreground">
                Method: <span className="font-mono">GET</span> · 자동 변환(JSON→CSV):
                <strong> 켜짐</strong> · 응답은 스크래핑 완료 + 미송출 job의 배열
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">
                ② 디버깅용 미리보기 URL (호출해도 송출 마킹 안 함)
              </p>
              <div className="flex items-start gap-2">
                <code className="flex-1 break-all rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs">
                  {canvasJobsPeekUrl}
                </code>
                <CopyButton text={canvasJobsPeekUrl} label="URL 복사" />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">
                ③ 이 업체 단건 URL (개별 조회용, 마킹 없음)
              </p>
              <div className="flex items-start gap-2">
                <code className="flex-1 break-all rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs">
                  {canvasApiUrl}
                </code>
                <CopyButton text={canvasApiUrl} label="URL 복사" />
              </div>
            </div>

            <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs space-y-1">
              <p className="font-semibold">현재 이 job의 송출 상태</p>
              <p>
                <span className="text-muted-foreground">Place ID: </span>
                <span className="font-mono">
                  {job.placeId || scraped?.placeId || "(스크래핑 대기 중)"}
                </span>
              </p>
              <p>
                <span className="text-muted-foreground">AI Canvas 송출: </span>
                {job.canvasPulledAt ? (
                  <span>✅ {formatDate(job.canvasPulledAt)}에 송출됨</span>
                ) : job.scrapeStatus === "done" ? (
                  <span className="text-amber-700 dark:text-amber-300">
                    ⏳ 다음 스케줄 실행 시 송출 예정
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    스크래핑 완료 후 송출 대기
                  </span>
                )}
              </p>
            </div>

            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                AI Canvas 쪽 셋업 방법 보기
              </summary>
              <ol className="list-decimal space-y-1 pl-5 pt-2 text-muted-foreground">
                <li>
                  AI Canvas에서 새 캔버스 생성 → <strong>커스텀 API</strong>
                  노드를 캔버스에 드래그
                </li>
                <li>
                  속성 패널: <strong>요청 모드 = 단일 요청</strong>,
                  <strong> URL</strong>에 위 ① 목록 엔드포인트 붙여넣기,
                  <strong> Method = GET</strong>,
                  <strong> 자동 변환 켜짐</strong>
                </li>
                <li>
                  <strong>네이버 플레이스 리뷰</strong> 노드를 추가하고 커스텀 API
                  노드의 출력 포트를 입력 포트에 연결. 플레이스 ID 입력 항목에
                  <strong> placeId</strong> 컬럼 지정
                </li>
                <li>
                  (선택) 이후 전처리/분석/저장 노드를 원하는 대로 연결
                </li>
                <li>
                  캔버스 우측 <strong>스케줄</strong> 탭 → 대상 노드로 커스텀 API
                  노드 선택 → 주기 <strong>매분</strong> (또는 5분) → 등록
                </li>
              </ol>
            </details>
          </CardContent>
        </Card>

        {scraped ? (
          <SectionCard title="추출된 플레이스 정보" accentColor="var(--naver-green)">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-0.5 rounded-lg p-3" style={{ backgroundColor: "var(--naver-green-50)" }}>
                <p className="text-[0.65rem] font-semibold" style={{ color: "var(--naver-green-dark)" }}>업체명</p>
                <p className="text-sm font-bold" style={{ color: "var(--naver-gray-900)" }}>{scraped.name || "-"}</p>
              </div>
              <div className="space-y-0.5 rounded-lg p-3" style={{ backgroundColor: "var(--naver-green-50)" }}>
                <p className="text-[0.65rem] font-semibold" style={{ color: "var(--naver-green-dark)" }}>카테고리</p>
                <p className="text-sm font-bold" style={{ color: "var(--naver-gray-900)" }}>{scraped.category || "-"}</p>
              </div>
              <div className="space-y-0.5 rounded-lg p-3" style={{ backgroundColor: "var(--naver-green-50)" }}>
                <p className="text-[0.65rem] font-semibold" style={{ color: "var(--naver-green-dark)" }}>별점/리뷰</p>
                <p className="text-sm font-bold" style={{ color: "var(--naver-gray-900)" }}>{formatRating(scraped) || "-"}</p>
              </div>
              <div className="space-y-0.5 rounded-lg p-3" style={{ backgroundColor: "var(--naver-green-50)" }}>
                <p className="text-[0.65rem] font-semibold" style={{ color: "var(--naver-green-dark)" }}>전화</p>
                <p className="text-sm font-bold" style={{ color: "var(--naver-gray-900)" }}>{scraped.phone || "-"}</p>
              </div>
            </div>

            <div className="mt-4 divide-y rounded-lg ring-1 ring-[var(--naver-gray-200)]">
              <PlaceInfoRow label="Place ID" mono>
                <span className="flex items-center gap-2">
                  {scraped.placeId || job.placeId || "-"}
                  {(scraped.placeId || job.placeId) && (
                    <CopyButton text={scraped.placeId || job.placeId || ""} label="ID 복사" />
                  )}
                </span>
              </PlaceInfoRow>
              <PlaceInfoRow label="플레이스 URL">
                <span className="flex items-start gap-2 break-all">
                  <a
                    href={scraped.inputUrl || job.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2"
                    style={{ color: "var(--naver-green-dark)" }}
                  >
                    {scraped.inputUrl || job.url}
                  </a>
                  <CopyButton text={scraped.inputUrl || job.url} label="URL 복사" />
                </span>
              </PlaceInfoRow>
              <PlaceInfoRow label="주소">{scraped.address || "-"}</PlaceInfoRow>
              <PlaceInfoRow label="영업시간">{scraped.hours || "-"}</PlaceInfoRow>
              <PlaceInfoRow label="홈페이지">
                <span className="break-all">{scraped.homepage || "-"}</span>
              </PlaceInfoRow>
              <PlaceInfoRow label="편의시설">{scraped.amenities || "-"}</PlaceInfoRow>
              {scraped.description && (
                <PlaceInfoRow label="AI 브리핑">
                  <span className="whitespace-pre-wrap">{scraped.description}</span>
                </PlaceInfoRow>
              )}
            </div>

          </SectionCard>
        ) : job.scrapeStatus === "done" ? (
          <SectionCard title="플레이스 정보" accentColor="var(--naver-gray-500)">
            <p className="py-6 text-center text-sm" style={{ color: "var(--naver-gray-500)" }}>
              DB에 스크래핑된 상세 정보가 없습니다.
            </p>
          </SectionCard>
        ) : (
          <SectionCard title="플레이스 정보" accentColor="var(--naver-gray-500)">
            <p className="py-6 text-center text-sm" style={{ color: "var(--naver-gray-500)" }}>
              작업지 생성 대기 중입니다. 잠시 후 새로고침해 주세요.
            </p>
          </SectionCard>
        )}

        {(() => {
          const v2Menus = (scraped as (ScrapedPlace & { menuItemsV2?: MenuItem[] }) | null)?.menuItemsV2;
          const menuDisplays = v2Menus && v2Menus.length > 0
            ? v2Menus.map((m) => ({ name: m.name, price: m.price, description: m.description }))
            : (scraped?.menuItems ?? []).map((m) => {
                const parts = m.split(" · ");
                return { name: parts[0] || m, price: parts[1] || "", description: undefined };
              });

          if (menuDisplays.length > 0) {
            const reviewsArr = (() => {
              let r = job.reviewsData;
              try {
                if (typeof r === "string") r = JSON.parse(r);
                if (r && !Array.isArray(r)) r = [r];
              } catch {}
              return Array.isArray(r) ? r : [];
            })();

            return (
              <MenuEvaluationPanel
                jobId={job.id}
                menus={menuDisplays}
                hasReviews={reviewsArr.length > 0}
                initialEvaluation={job.menuEvaluation ?? null}
              />
            );
          }
          return null;
        })()}

        <ProbePanel placeId={job.placeId || scraped?.placeId || null} />

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

        {(() => {
          const reviewsArr = (() => {
            let r = job.reviewsData;
            try {
              if (typeof r === "string") r = JSON.parse(r);
              if (r && !Array.isArray(r)) r = [r];
            } catch {}
            return Array.isArray(r) ? r : [];
          })();
          if (reviewsArr.length === 0) return null;
          return (
            <>
              <ReviewAnalysisPanel
                jobId={job.id}
                reviewCount={reviewsArr.length}
                initialAnalysis={job.reviewAnalysis ?? null}
              />
              <ReviewIntroPanel
                jobId={job.id}
                hasAnalysis={!!job.reviewAnalysis}
                prompts={allPrompts
                  .filter((p) => p.sectionType === "review_intro")
                  .map((p) => ({
                    id: p.id,
                    name: p.name,
                    description: p.description,
                    guide: p.guide,
                    isDefault: p.isDefault,
                  }))}
                initialIntro={job.reviewIntro ?? null}
              />
              <OwnerIntroPanel
                jobId={job.id}
                hasAnalysis={!!job.reviewAnalysis}
                initialIntro={job.ownerIntro ?? null}
              />
            </>
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

/* ── 헬퍼 서버 컴포넌트들 ── */

function SectionCard({
  title,
  accentColor,
  children,
}: {
  title: string;
  accentColor: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-[var(--naver-gray-200)]"
      style={{ borderLeft: `3px solid ${accentColor}` }}
    >
      <div className="border-b px-5 py-3" style={{ borderColor: "var(--naver-gray-200)" }}>
        <h3 className="text-sm font-bold" style={{ color: "var(--naver-gray-900)" }}>
          {title}
        </h3>
      </div>
      <div className="px-5 py-4 text-sm">{children}</div>
    </div>
  );
}

function InfoGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="divide-y rounded-lg ring-1 ring-[var(--naver-gray-200)]">
      {children}
    </div>
  );
}

function InfoRow({
  label,
  value,
  breakAll,
  preWrap,
  mono,
  error,
}: {
  label: string;
  value: string;
  breakAll?: boolean;
  preWrap?: boolean;
  mono?: boolean;
  error?: boolean;
}) {
  return (
    <div className="flex gap-3 px-4 py-2.5 text-[0.8rem]">
      <span
        className="w-20 shrink-0 font-semibold"
        style={{ color: "var(--naver-gray-500)" }}
      >
        {label}
      </span>
      <span
        className={`flex-1 ${breakAll ? "break-all" : ""} ${preWrap ? "whitespace-pre-wrap" : ""} ${mono ? "font-mono" : ""}`}
        style={{ color: error ? "var(--naver-red)" : "var(--naver-gray-900)" }}
      >
        {value}
      </span>
    </div>
  );
}

function PlaceInfoRow({
  label,
  children,
  mono,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex gap-3 px-4 py-2.5 text-[0.8rem]">
      <span
        className="w-24 shrink-0 font-semibold"
        style={{ color: "var(--naver-gray-500)" }}
      >
        {label}
      </span>
      <span
        className={`flex-1 ${mono ? "font-mono" : ""}`}
        style={{ color: "var(--naver-gray-900)" }}
      >
        {children}
      </span>
    </div>
  );
}
