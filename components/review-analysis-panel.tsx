"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ReviewAnalysis } from "@/lib/jobs";

type Props = {
  jobId: string;
  reviewCount: number;
  initialAnalysis: ReviewAnalysis | null;
};

function formatDate(iso?: string): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("ko-KR");
  } catch {
    return iso;
  }
}

function SentimentBar({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "positive" | "negative" | "neutral";
}) {
  const color =
    tone === "positive"
      ? "bg-emerald-500"
      : tone === "negative"
        ? "bg-rose-500"
        : "bg-muted-foreground/50";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono tabular-nums">{value.toFixed(1)}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full ${color}`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
}

export function ReviewAnalysisPanel({
  jobId,
  reviewCount,
  initialAnalysis,
}: Props) {
  const router = useRouter();
  const [analysis, setAnalysis] = useState<ReviewAnalysis | null>(
    initialAnalysis,
  );
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function runAnalysis() {
    setLoading(true);
    try {
      const res = await fetch(`/api/reviews/analyze?jobId=${jobId}`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "분석 실패", {
          description: json.details,
        });
        return;
      }
      setAnalysis(json.analysis);
      toast.success("리뷰 분석 완료");
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error("네트워크 오류", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  }

  const busy = loading || isPending;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle>리뷰 AI 분석</CardTitle>
          <CardDescription>
            수집된 {reviewCount}건의 리뷰를 Claude로 분석해 종합요약·감성·키워드·강점·개선사항·페르소나·황금키워드를 추출합니다.
          </CardDescription>
          {analysis && (
            <p className="pt-1 text-xs text-muted-foreground">
              최근 분석: {formatDate(analysis.meta.analyzedAt)} · 모델{" "}
              <span className="font-mono">{analysis.meta.model}</span> · 리뷰{" "}
              {analysis.meta.reviewCount}건
            </p>
          )}
        </div>
        <Button onClick={runAnalysis} disabled={busy || reviewCount === 0}>
          {busy ? "분석 중…" : analysis ? "재분석" : "분석 실행"}
        </Button>
      </CardHeader>

      {analysis && (
        <CardContent className="space-y-6">
          {/* 종합 요약 */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">📝 종합 요약</h3>
            <p className="rounded-md border bg-muted/40 px-4 py-3 text-sm whitespace-pre-wrap">
              {analysis.summary}
            </p>
          </section>

          {/* 감성 분석 */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">😊 감성 분석</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <SentimentBar
                label="긍정"
                value={analysis.sentiment.positive}
                tone="positive"
              />
              <SentimentBar
                label="중립"
                value={analysis.sentiment.neutral}
                tone="neutral"
              />
              <SentimentBar
                label="부정"
                value={analysis.sentiment.negative}
                tone="negative"
              />
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Badge variant="secondary">
                종합 점수 {analysis.sentiment.score.toFixed(2)}
              </Badge>
              <span className="text-muted-foreground">
                {analysis.sentiment.tone}
              </span>
            </div>
          </section>

          {/* 키워드 분석 */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">🏷 키워드 분석</h3>
            <div className="flex flex-wrap gap-2">
              {analysis.keywords.map((k) => (
                <Badge
                  key={k.word}
                  variant="outline"
                  title={k.context}
                  className="cursor-help"
                >
                  {k.word}{" "}
                  <span className="ml-1 font-mono text-[0.65rem] text-muted-foreground">
                    ×{k.count}
                  </span>
                </Badge>
              ))}
            </div>
          </section>

          {/* 강점 / 개선사항 2열 */}
          <div className="grid gap-4 md:grid-cols-2">
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                💪 업체 핵심 강점
              </h3>
              <ul className="space-y-1.5 rounded-md border bg-emerald-50/40 px-4 py-3 text-sm dark:bg-emerald-950/20">
                {analysis.strengths.map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-emerald-600 dark:text-emerald-400">
                      ◆
                    </span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                🔧 개선 사항 참고
              </h3>
              {analysis.improvements.length > 0 ? (
                <ul className="space-y-1.5 rounded-md border bg-amber-50/40 px-4 py-3 text-sm dark:bg-amber-950/20">
                  {analysis.improvements.map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-amber-600 dark:text-amber-400">
                        ▲
                      </span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-md border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                  특별한 개선 요구사항이 발견되지 않았습니다.
                </p>
              )}
            </section>
          </div>

          {/* 고객 페르소나 */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">👥 매장 고객 페르소나</h3>
            <div className="grid gap-3 md:grid-cols-2">
              {analysis.personas.map((p, i) => (
                <div
                  key={i}
                  className="space-y-2 rounded-md border bg-muted/30 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold">{p.name}</h4>
                    <Badge variant="outline" className="text-[0.65rem]">
                      {p.ageRange}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {p.description}
                  </p>
                  <div className="grid grid-cols-[5rem_1fr] gap-y-1 text-xs">
                    <span className="text-muted-foreground">방문 목적</span>
                    <span>{p.visitPurpose}</span>
                    <span className="text-muted-foreground">동반자</span>
                    <span>{p.companions}</span>
                    <span className="text-muted-foreground">선호 요소</span>
                    <span>{p.preferences}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 황금 키워드 */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">✨ 리뷰 속 황금 키워드</h3>
            <p className="text-xs text-muted-foreground">
              SEO/마케팅 활용도가 높은 키워드 — 클릭해서 복사하세요.
            </p>
            <div className="flex flex-wrap gap-2">
              {analysis.goldenKeywords.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(g);
                    toast.success(`복사됨: ${g}`);
                  }}
                  className="rounded-full border border-amber-400 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-900/40"
                >
                  {g}
                </button>
              ))}
            </div>
          </section>
        </CardContent>
      )}

      {!analysis && (
        <CardContent>
          <p className="text-sm text-muted-foreground">
            아직 분석 결과가 없습니다. 상단 <strong>&quot;분석 실행&quot;</strong>{" "}
            버튼으로 리뷰 분석을 시작하세요. (소요 시간 약 20~60초)
          </p>
        </CardContent>
      )}
    </Card>
  );
}
