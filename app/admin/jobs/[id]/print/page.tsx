import { notFound } from "next/navigation";

import { PrintTrigger } from "@/components/print-trigger";
import { readJob } from "@/lib/jobs";
import type { ReviewAnalysis, MenuEvaluation } from "@/lib/jobs";
import type { ProbeResult } from "@/lib/probe";
import type { ScrapedPlace } from "@/lib/scraper/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PageProps = { params: Promise<{ id: string }> };

const BRAND = "ABYSSX";

function fmtPercent(n?: number | null): string {
  if (typeof n !== "number" || Number.isNaN(n)) return "-";
  return `${Math.round(n)}%`;
}

export default async function PrintPage({ params }: PageProps) {
  const { id } = await params;
  const job = await readJob(id);
  if (!job) notFound();

  const scraped = job.scrapedData as ScrapedPlace | null;
  const analysis = job.reviewAnalysis as ReviewAnalysis | null;
  const menuEval = job.menuEvaluation as MenuEvaluation | null;
  const probe = job.probeData as ProbeResult | null;

  const placeName = job.placeName || scraped?.name || "(이름 미상)";
  const reportTitle = `${BRAND} ${placeName} 플레이스 분석 보고서`;
  const generatedAt = new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="print-root mx-auto max-w-[820px] bg-white px-12 pb-12 text-slate-900">
      <PrintTrigger />

      {/* 인쇄 시 매 페이지 상단에 박힐 러닝 헤더 */}
      <div className="print-running-header">
        <span className="font-bold tracking-[0.18em]">{BRAND}</span>
        <span className="mx-2 text-slate-300">|</span>
        <span>{placeName} 플레이스 분석 보고서</span>
      </div>

      {/* ─── 표지 (커버) ─── */}
      <header className="cover page-break-after relative flex h-[260mm] flex-col justify-between pt-10">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.4em] text-emerald-600">
            {BRAND}
          </p>
          <div className="mt-3 h-1 w-16 bg-emerald-500" />
        </div>

        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-400">
            Place Analytics Report
          </p>
          <h1 className="mt-4 text-[44px] font-extrabold leading-[1.05] tracking-tight text-slate-900">
            {placeName}
            <span className="block text-[28px] font-medium text-slate-600">
              플레이스 분석 보고서
            </span>
          </h1>
          {scraped?.category && (
            <p className="mt-6 inline-block rounded-full border border-slate-300 px-4 py-1.5 text-xs font-medium text-slate-600">
              {scraped.category}
            </p>
          )}
        </div>

        <div className="flex items-end justify-between border-t pt-6 text-xs text-slate-500">
          <div>
            <p className="font-semibold text-slate-700">발행일</p>
            <p>{generatedAt}</p>
          </div>
          <p className="text-[10px] uppercase tracking-[0.25em]">
            Confidential · {BRAND}
          </p>
        </div>
      </header>

      {/* ─── 1. 추출 정보 ─── */}
      <Section title="추출 정보" index={1} caption="네이버 플레이스 페이지에서 자동 수집된 핵심 메타데이터">
        <div className="grid grid-cols-2 gap-3">
          <Stat label="별점" value={scraped?.rating || "-"} accent />
          <Stat label="방문자 리뷰" value={scraped?.visitorReviews || "-"} />
          <Stat label="블로그 리뷰" value={scraped?.blogReviews || "-"} />
          <Stat label="Place ID" value={job.placeId || "-"} mono />
        </div>
        <div className="mt-5 overflow-hidden rounded-lg border border-slate-200">
          <KvRow label="업체명" value={placeName} />
          {scraped?.category && <KvRow label="카테고리" value={scraped.category} />}
          {scraped?.address && <KvRow label="주소" value={scraped.address} />}
          {scraped?.phone && <KvRow label="전화번호" value={scraped.phone} mono />}
        </div>
      </Section>

      {/* ─── 2. 네이버 AI 브리핑 ─── */}
      {scraped?.description && (
        <Section title="네이버 AI 브리핑" index={2} caption="네이버가 리뷰를 종합해 자동 생성한 업체 요약">
          <div className="rounded-lg border-l-4 border-emerald-500 bg-emerald-50/50 p-5">
            <p className="whitespace-pre-line text-sm leading-relaxed text-slate-800">
              {scraped.description}
            </p>
          </div>
        </Section>
      )}

      {/* ─── 3. 부가서비스 활성 체크 ─── */}
      {probe && <ProbeSection probe={probe} index={3} />}

      {/* ─── 4. 리뷰 AI 분석 ─── */}
      {analysis && <AnalysisSection analysis={analysis} index={4} />}

      {/* ─── 5. 메뉴 분석 (종합 + 메뉴별) ─── */}
      {menuEval && <MenuEvalSection evaluation={menuEval} index={5} />}

      {/* ─── 푸터 ─── */}
      <footer className="mt-16 flex items-center justify-between border-t pt-4 text-xs text-slate-500">
        <span className="font-bold tracking-[0.18em]">{BRAND}</span>
        <span>{reportTitle}</span>
        <span>{generatedAt}</span>
      </footer>
    </div>
  );
}

/* ────────────── 빌딩 블록 ────────────── */

function Section({
  title,
  index,
  caption,
  children,
}: {
  title: string;
  index?: number;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="page-section avoid-break mt-12">
      <div className="mb-5 flex items-end justify-between border-b-2 border-slate-900 pb-3">
        <div>
          {typeof index === "number" && (
            <p className="text-[11px] font-bold tracking-[0.25em] text-emerald-600">
              SECTION · {String(index).padStart(2, "0")}
            </p>
          )}
          <h2 className="mt-1 text-2xl font-bold text-slate-900">{title}</h2>
        </div>
        {caption && (
          <p className="ml-6 max-w-[280px] text-right text-[11px] leading-snug text-slate-500">
            {caption}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

function KvRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline border-b border-slate-100 px-4 py-2.5 last:border-b-0 odd:bg-slate-50/60">
      <span className="w-24 shrink-0 text-xs font-semibold text-slate-500">
        {label}
      </span>
      <span
        className={`flex-1 break-all text-sm text-slate-800 ${mono ? "font-mono" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  mono,
}: {
  label: string;
  value: string;
  accent?: boolean;
  mono?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-4 py-3 ${
        accent
          ? "border-emerald-300 bg-emerald-50"
          : "border-slate-200 bg-slate-50"
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p
        className={`mt-1 text-xl font-bold ${
          accent ? "text-emerald-700" : "text-slate-900"
        } ${mono ? "font-mono text-base" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

/* ────────────── 부가서비스 ────────────── */

function ProbeSection({ probe, index }: { probe: ProbeResult; index: number }) {
  const total = probe.features.length;
  const active = probe.features.filter((f) => f.active).length;
  return (
    <Section
      title="부가서비스 활성 체크"
      index={index}
      caption="네이버 플레이스가 제공하는 주요 기능의 활성 여부"
    >
      <div className="mb-4 flex items-center justify-between rounded-lg bg-slate-900 px-5 py-3 text-white">
        <span className="text-sm font-medium">활성화 현황</span>
        <span className="text-2xl font-extrabold">
          {active}
          <span className="text-base font-medium text-slate-300"> / {total}</span>
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {probe.features.map((f) => (
          <div
            key={f.key}
            className={`avoid-break rounded-lg border p-3 ${
              f.active
                ? "border-emerald-400 bg-emerald-50/70"
                : "border-slate-200 bg-slate-50/50"
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                  f.active
                    ? "bg-emerald-500 text-white"
                    : "border border-slate-300 text-slate-400"
                }`}
              >
                {f.active ? "✓" : "·"}
              </span>
              <p
                className={`text-sm font-semibold ${
                  f.active ? "text-slate-900" : "text-slate-500"
                }`}
              >
                {f.label}
              </p>
            </div>
            {f.evidence.length > 0 && (
              <ul className="mt-2 space-y-0.5 pl-7 text-[11px] leading-snug text-slate-600">
                {f.evidence.slice(0, 3).map((e, i) => (
                  <li key={i}>· {e}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ────────────── 리뷰 AI 분석 ────────────── */

function AnalysisSection({
  analysis,
  index,
}: {
  analysis: ReviewAnalysis;
  index: number;
}) {
  const s = analysis.sentiment;
  return (
    <Section
      title="리뷰 AI 분석"
      index={index}
      caption="수집된 리뷰를 AI가 종합 분석한 결과 — 감성, 키워드, 강점, 페르소나"
    >
      <div className="space-y-6">
        {/* 종합 요약 */}
        <div className="rounded-xl bg-slate-900 p-6 text-white">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-400">
            Executive Summary
          </p>
          <p className="mt-3 text-[15px] leading-relaxed">{analysis.summary}</p>
        </div>

        {/* 감성 */}
        <div className="avoid-break">
          <SubHead title="감성 분석" />
          <div className="grid grid-cols-[1fr_auto] items-center gap-4">
            <div>
              <div className="flex h-5 w-full overflow-hidden rounded-full border border-slate-200">
                <div
                  className="bg-emerald-500"
                  style={{ width: `${s.positive}%` }}
                />
                <div className="bg-slate-300" style={{ width: `${s.neutral}%` }} />
                <div className="bg-rose-500" style={{ width: `${s.negative}%` }} />
              </div>
              <div className="mt-2 flex gap-4 text-xs">
                <Legend dotColor="bg-emerald-500" label="긍정" value={fmtPercent(s.positive)} />
                <Legend dotColor="bg-slate-300" label="중립" value={fmtPercent(s.neutral)} />
                <Legend dotColor="bg-rose-500" label="부정" value={fmtPercent(s.negative)} />
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                종합 점수
              </p>
              <p className="mt-1 text-2xl font-extrabold text-emerald-600">
                {s.score?.toFixed?.(2) ?? "-"}
              </p>
              <p className="text-[10px] text-slate-400">−1.0 ~ +1.0</p>
            </div>
          </div>
          <p className="mt-3 rounded-md border-l-2 border-slate-300 bg-slate-50 px-3 py-2 text-sm italic text-slate-700">
            "{s.tone}"
          </p>
        </div>

        {/* 강점 / 개선 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="avoid-break rounded-lg border border-emerald-200 bg-emerald-50/40 p-4">
            <SubHead title="강점" tone="emerald" />
            <ul className="space-y-1.5 text-sm leading-snug text-slate-800">
              {analysis.strengths.map((v, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-emerald-600">+</span>
                  <span>{v}</span>
                </li>
              ))}
            </ul>
          </div>
          {analysis.improvements.length > 0 && (
            <div className="avoid-break rounded-lg border border-rose-200 bg-rose-50/40 p-4">
              <SubHead title="개선 사항" tone="rose" />
              <ul className="space-y-1.5 text-sm leading-snug text-slate-800">
                {analysis.improvements.map((v, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-rose-600">·</span>
                    <span>{v}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* 키워드 */}
        <div className="avoid-break">
          <SubHead title="핵심 키워드" />
          <div className="flex flex-wrap gap-1.5">
            {analysis.keywords.map((k, i) => (
              <span
                key={i}
                className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs"
              >
                {k.word}
              </span>
            ))}
          </div>
        </div>

        {/* 황금 키워드 */}
        <div className="avoid-break">
          <SubHead title="황금 키워드" caption="SEO·마케팅에 즉시 활용 가능한 고부가 키워드" />
          <div className="flex flex-wrap gap-1.5">
            {analysis.goldenKeywords.map((g, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900"
              >
                <span className="text-amber-500">★</span>
                {g}
              </span>
            ))}
          </div>
        </div>

        {/* 페르소나 */}
        <div>
          <SubHead title="대표 페르소나" caption="리뷰 패턴에서 추출한 주요 고객 유형" />
          <div className="grid grid-cols-2 gap-3">
            {analysis.personas.map((p, i) => (
              <div
                key={i}
                className="avoid-break rounded-lg border border-slate-200 bg-white p-4"
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                  Persona {i + 1}
                </p>
                <p className="mt-1 text-base font-bold text-slate-900">{p.name}</p>
                <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
                  <Tag>{p.ageRange}</Tag>
                  <Tag>{p.companions}</Tag>
                  <Tag>{p.visitPurpose}</Tag>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-slate-700">
                  {p.description}
                </p>
                <p className="mt-2 text-[11px] text-slate-500">
                  <span className="font-semibold">선호:</span> {p.preferences}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}

function SubHead({
  title,
  caption,
  tone,
}: {
  title: string;
  caption?: string;
  tone?: "emerald" | "rose";
}) {
  const colorCls =
    tone === "emerald"
      ? "text-emerald-700"
      : tone === "rose"
        ? "text-rose-700"
        : "text-slate-800";
  return (
    <div className="mb-2 flex items-baseline gap-2">
      <h3 className={`text-sm font-bold ${colorCls}`}>{title}</h3>
      {caption && <p className="text-[11px] text-slate-500">— {caption}</p>}
    </div>
  );
}

function Legend({
  dotColor,
  label,
  value,
}: {
  dotColor: string;
  label: string;
  value: string;
}) {
  return (
    <span className="inline-flex items-center gap-1 text-slate-600">
      <span className={`inline-block h-2 w-2 rounded-full ${dotColor}`} />
      {label} <strong className="text-slate-900">{value}</strong>
    </span>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
      {children}
    </span>
  );
}

/* ────────────── 메뉴 분석 ────────────── */

function MenuEvalSection({
  evaluation,
  index,
}: {
  evaluation: MenuEvaluation;
  index: number;
}) {
  const ov = evaluation.overall;
  return (
    <Section
      title="메뉴 분석"
      index={index}
      caption="메뉴별 리뷰 평가 + 종합 분석"
    >
      <div className="space-y-5">
        {/* 종합 분석 */}
        <div className="rounded-xl border border-slate-300 bg-gradient-to-br from-slate-50 to-white p-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-600">
            Overall Insight
          </p>
          <h3 className="mt-2 text-lg font-bold text-slate-900">종합 분석</h3>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-800">
            {ov.expertComment}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-md bg-emerald-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                대표 추천
              </p>
              <p className="mt-1 text-sm font-bold text-slate-900">{ov.bestMenu}</p>
              {ov.bestMenuReason && (
                <p className="mt-1 text-[11px] leading-snug text-slate-600">
                  {ov.bestMenuReason}
                </p>
              )}
            </div>
            <div className="rounded-md bg-rose-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700">
                개선 필요
              </p>
              <p className="mt-1 text-sm font-bold text-slate-900">{ov.worstMenu}</p>
              {ov.worstMenuReason && (
                <p className="mt-1 text-[11px] leading-snug text-slate-600">
                  {ov.worstMenuReason}
                </p>
              )}
            </div>
          </div>

          {ov.commonKeywords && ov.commonKeywords.length > 0 && (
            <div className="mt-5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                공통 키워드
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {ov.commonKeywords.map((k, i) => (
                  <span
                    key={i}
                    className="rounded-full border border-slate-300 bg-white px-2.5 py-0.5 text-xs text-slate-700"
                  >
                    {k}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 flex gap-6 border-t border-slate-200 pt-4 text-[11px] text-slate-500">
            <span>
              종합 평점{" "}
              <strong className="text-slate-900">{ov.totalRating || "-"}</strong>
            </span>
            <span>
              총 리뷰 수{" "}
              <strong className="text-slate-900">{ov.totalReviewCount}</strong>
            </span>
          </div>
        </div>

        {/* 메뉴별 평가 */}
        <div>
          <SubHead title="메뉴별 평가" />
          <div className="space-y-3">
            {evaluation.items.map((it, i) => (
              <div
                key={i}
                className="avoid-break rounded-lg border border-slate-200 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <h4 className="text-base font-bold text-slate-900">{it.menu}</h4>
                  {it.needsImprovement && (
                    <span className="shrink-0 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-700">
                      개선 필요
                    </span>
                  )}
                </div>
                {it.reviewSummary && (
                  <p className="mt-2 text-xs leading-relaxed text-slate-700">
                    {it.reviewSummary}
                  </p>
                )}
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {it.strengths.length > 0 && (
                    <div className="rounded-md bg-emerald-50/60 p-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                        + 강점
                      </p>
                      <ul className="mt-1 space-y-0.5 text-[11px] leading-snug text-slate-700">
                        {it.strengths.map((s, j) => (
                          <li key={j}>· {s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {it.weaknesses.length > 0 && (
                    <div className="rounded-md bg-rose-50/60 p-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700">
                        − 약점
                      </p>
                      <ul className="mt-1 space-y-0.5 text-[11px] leading-snug text-slate-700">
                        {it.weaknesses.map((w, j) => (
                          <li key={j}>· {w}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                {it.improvementSuggestion && (
                  <p className="mt-3 rounded-md border-l-2 border-emerald-400 bg-emerald-50/40 px-3 py-2 text-xs text-slate-700">
                    <span className="font-semibold text-emerald-700">제안 →</span>{" "}
                    {it.improvementSuggestion}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}
