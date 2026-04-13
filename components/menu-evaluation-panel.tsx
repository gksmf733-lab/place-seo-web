"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type {
  MenuEvaluation,
  MenuEvalItem,
  MenuOverallAnalysis,
} from "@/lib/jobs";

type MenuDisplay = {
  name: string;
  price: string;
  description?: string;
};

type Props = {
  jobId: string;
  menus: MenuDisplay[];
  hasReviews: boolean;
  initialEvaluation: MenuEvaluation | null;
  /** 버티컬 라벨 (예: "시술 메뉴", "객실", "강좌") */
  itemsLabel?: string;
  /** 단위 명사 (예: "시술", "객실") */
  itemUnit?: string;
};

function formatDate(iso?: string): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("ko-KR");
  } catch {
    return iso;
  }
}

export function MenuEvaluationPanel({
  jobId,
  menus,
  hasReviews,
  initialEvaluation,
  itemsLabel = "메뉴",
  itemUnit = "메뉴",
}: Props) {
  const router = useRouter();
  const [evaluation, setEvaluation] = useState<MenuEvaluation | null>(
    initialEvaluation,
  );
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [overallOpen, setOverallOpen] = useState(false);

  const busy = loading || isPending;

  const evalMap = new Map<string, MenuEvalItem>();
  if (evaluation) {
    for (const item of evaluation.items) {
      evalMap.set(item.menu, item);
    }
  }

  async function onGenerate() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/reviews/menu-eval?jobId=${encodeURIComponent(jobId)}`,
        { method: "POST" },
      );
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "평가 생성 실패", {
          description: json.details,
        });
        return;
      }
      setEvaluation(json.evaluation);
      toast.success("메뉴별 평가가 완료되었습니다.");
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error("네트워크 오류", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  }

  function toggleMenu(idx: number) {
    setExpandedIdx((prev) => (prev === idx ? null : idx));
  }

  return (
    <div
      className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-[var(--naver-gray-200)]"
      style={{ borderLeft: "3px solid var(--naver-green)" }}
    >
      {/* ── 헤더 ── */}
      <div
        className="flex items-center justify-between gap-4 border-b px-5 py-3"
        style={{ borderColor: "var(--naver-gray-200)" }}
      >
        <div>
          <h3
            className="text-sm font-bold"
            style={{ color: "var(--naver-gray-900)" }}
          >
            {itemsLabel} ({menus.length}건)
          </h3>
          {evaluation && (
            <p
              className="mt-0.5 text-[0.65rem]"
              style={{ color: "var(--naver-gray-500)" }}
            >
              최근 분석: {formatDate(evaluation.meta.analyzedAt)} · 리뷰{" "}
              {evaluation.meta.reviewCount}건 기반
            </p>
          )}
        </div>
        <Button
          onClick={onGenerate}
          disabled={busy || !hasReviews || menus.length === 0}
          size="sm"
        >
          {busy ? "분석 중…" : evaluation ? "재분석" : `${itemUnit} 평가 생성`}
        </Button>
      </div>

      {/* ── 메뉴 리스트 + 인라인 아코디언 ── */}
      <div className="divide-y" style={{ borderColor: "var(--naver-gray-200)" }}>
        {menus.map((menu, idx) => {
          const evalItem = evalMap.get(menu.name);
          const isExpanded = expandedIdx === idx;

          return (
            <div key={idx}>
              {/* 메뉴 행 */}
              <button
                type="button"
                onClick={() => evaluation && toggleMenu(idx)}
                className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-[var(--naver-gray-50)]"
                disabled={!evaluation}
              >
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[0.65rem] font-bold"
                  style={{
                    backgroundColor: "var(--naver-green-50)",
                    color: "var(--naver-green-dark)",
                  }}
                >
                  {idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className="text-sm font-semibold"
                    style={{ color: "var(--naver-gray-900)" }}
                  >
                    {menu.name}
                  </p>
                  {menu.description ? (
                    <p
                      className="mt-0.5 truncate text-xs"
                      style={{ color: "var(--naver-gray-500)" }}
                    >
                      {menu.description}
                    </p>
                  ) : (
                    <p
                      className="mt-0.5 text-xs italic"
                      style={{ color: "var(--naver-gray-200)" }}
                    >
                      설명없음
                    </p>
                  )}
                </div>
                <span
                  className="shrink-0 rounded-md px-2.5 py-1 text-xs font-bold"
                  style={{
                    backgroundColor: "var(--naver-green-50)",
                    color: "var(--naver-green-dark)",
                  }}
                >
                  {menu.price}
                </span>
                {evaluation && (
                  <span
                    className="shrink-0 text-xs transition-transform duration-200"
                    style={{
                      color: "var(--naver-gray-500)",
                      transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                    }}
                  >
                    ▼
                  </span>
                )}
              </button>

              {/* 아코디언 드롭 */}
              <div
                className="overflow-hidden transition-all duration-300 ease-in-out"
                style={{
                  maxHeight: isExpanded && evalItem ? "800px" : "0px",
                  opacity: isExpanded && evalItem ? 1 : 0,
                }}
              >
                {evalItem && (
                  <div
                    className="border-t px-5 py-4 space-y-3"
                    style={{
                      backgroundColor: "var(--naver-gray-50)",
                      borderColor: "var(--naver-gray-200)",
                    }}
                  >
                    {/* 1. 강점 */}
                    {evalItem.strengths.length > 0 && (
                      <EvalSection
                        title="고객이 뽑은 강점"
                        color="var(--naver-green-dark)"
                      >
                        {evalItem.strengths.map((s, i) => (
                          <EvalBadge
                            key={i}
                            icon="✓"
                            iconColor="var(--naver-green)"
                            bg="var(--naver-green-50)"
                            text={s}
                          />
                        ))}
                      </EvalSection>
                    )}

                    {/* 2. 단점 */}
                    {evalItem.weaknesses.length > 0 && (
                      <EvalSection title="고객이 지적한 단점" color="var(--naver-red)">
                        {evalItem.weaknesses.map((w, i) => (
                          <EvalBadge
                            key={i}
                            icon="✗"
                            iconColor="var(--naver-red)"
                            bg="#FFF0F0"
                            text={w}
                          />
                        ))}
                      </EvalSection>
                    )}

                    {/* 3. 개선 사항 */}
                    <div
                      className="rounded-md px-3 py-2.5 text-xs"
                      style={{
                        backgroundColor: evalItem.needsImprovement
                          ? "#FFF3E0"
                          : "var(--naver-green-50)",
                      }}
                    >
                      <span
                        className="font-bold"
                        style={{
                          color: evalItem.needsImprovement
                            ? "var(--naver-amber)"
                            : "var(--naver-green-dark)",
                        }}
                      >
                        {evalItem.needsImprovement
                          ? "⚠ 개선 필요"
                          : "✓ 개선 불필요"}
                      </span>
                      {evalItem.needsImprovement &&
                        evalItem.improvementSuggestion && (
                          <p
                            className="mt-1.5"
                            style={{ color: "var(--naver-gray-900)" }}
                          >
                            <span className="font-semibold">개선 방향: </span>
                            {evalItem.improvementSuggestion}
                          </p>
                        )}
                    </div>

                    {/* 4. 리뷰 종합분석 */}
                    <div
                      className="rounded-md px-3 py-2.5 text-xs"
                      style={{ backgroundColor: "#F0F4FF" }}
                    >
                      <p
                        className="mb-1 font-bold"
                        style={{ color: "var(--naver-blue)" }}
                      >
                        {menu.name} 리뷰 종합분석
                      </p>
                      <p style={{ color: "var(--naver-gray-900)" }}>
                        {evalItem.reviewSummary || "리뷰 언급 없음"}
                      </p>
                    </div>

                    {evalItem.strengths.length === 0 &&
                      evalItem.weaknesses.length === 0 && (
                        <p
                          className="py-1 text-center text-xs"
                          style={{ color: "var(--naver-gray-500)" }}
                        >
                          이 메뉴에 대한 리뷰 언급이 없습니다.
                        </p>
                      )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── 종합 분석 버튼 + 아코디언 ── */}
      {evaluation?.overall && (
        <div className="border-t" style={{ borderColor: "var(--naver-gray-200)" }}>
          <button
            type="button"
            onClick={() => setOverallOpen((p) => !p)}
            className="flex w-full items-center justify-between px-5 py-3.5 text-left transition-colors hover:bg-[var(--naver-gray-50)]"
          >
            <span
              className="text-sm font-bold"
              style={{ color: "var(--naver-green-dark)" }}
            >
              📊 종합 분석
            </span>
            <span
              className="text-xs transition-transform duration-200"
              style={{
                color: "var(--naver-gray-500)",
                transform: overallOpen ? "rotate(180deg)" : "rotate(0deg)",
              }}
            >
              ▼
            </span>
          </button>

          <div
            className="overflow-hidden transition-all duration-300 ease-in-out"
            style={{
              maxHeight: overallOpen ? "1200px" : "0px",
              opacity: overallOpen ? 1 : 0,
            }}
          >
            <OverallAnalysisView overall={evaluation.overall} />
          </div>
        </div>
      )}

      {!hasReviews && (
        <div
          className="px-5 py-6 text-center text-xs"
          style={{ color: "var(--naver-gray-500)" }}
        >
          리뷰 데이터가 없어 메뉴 평가를 생성할 수 없습니다.
        </div>
      )}
    </div>
  );
}

/* ── 서브 컴포넌트 ── */

function EvalSection({
  title,
  color,
  children,
}: {
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-bold" style={{ color }}>
        ◆ {title}
      </p>
      <ul className="space-y-1">{children}</ul>
    </div>
  );
}

function EvalBadge({
  icon,
  iconColor,
  bg,
  text,
}: {
  icon: string;
  iconColor: string;
  bg: string;
  text: string;
}) {
  return (
    <li
      className="flex items-start gap-2 rounded-md px-3 py-2 text-xs"
      style={{ backgroundColor: bg }}
    >
      <span style={{ color: iconColor }}>{icon}</span>
      <span style={{ color: "var(--naver-gray-900)" }}>{text}</span>
    </li>
  );
}

function OverallAnalysisView({
  overall,
}: {
  overall: MenuOverallAnalysis;
}) {
  return (
    <div
      className="border-t px-5 py-5 space-y-4"
      style={{
        backgroundColor: "var(--naver-gray-50)",
        borderColor: "var(--naver-gray-200)",
      }}
    >
      {/* 평점 / 리뷰 수 */}
      <div className="flex gap-3">
        <div
          className="flex-1 rounded-lg px-4 py-3 text-center"
          style={{ backgroundColor: "var(--naver-green-50)" }}
        >
          <p
            className="text-[0.65rem] font-semibold"
            style={{ color: "var(--naver-green-dark)" }}
          >
            전체 평점
          </p>
          <p
            className="mt-0.5 text-xl font-bold"
            style={{ color: "var(--naver-green)" }}
          >
            {overall.totalRating}
          </p>
        </div>
        <div
          className="flex-1 rounded-lg px-4 py-3 text-center"
          style={{ backgroundColor: "var(--naver-green-50)" }}
        >
          <p
            className="text-[0.65rem] font-semibold"
            style={{ color: "var(--naver-green-dark)" }}
          >
            총 리뷰 수
          </p>
          <p
            className="mt-0.5 text-xl font-bold"
            style={{ color: "var(--naver-green)" }}
          >
            {overall.totalReviewCount.toLocaleString()}건
          </p>
        </div>
      </div>

      {/* 공통 키워드 */}
      <div>
        <p
          className="mb-2 text-xs font-bold"
          style={{ color: "var(--naver-gray-900)" }}
        >
          공통 키워드 및 특징
        </p>
        <div className="flex flex-wrap gap-1.5">
          {overall.commonKeywords.map((kw) => (
            <span
              key={kw}
              className="rounded-full px-2.5 py-1 text-[0.7rem] font-medium"
              style={{
                backgroundColor: "var(--naver-green-50)",
                color: "var(--naver-green-dark)",
                border: "1px solid var(--naver-green)",
              }}
            >
              {kw}
            </span>
          ))}
        </div>
      </div>

      {/* 호평 / 아쉬운 메뉴 */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg px-4 py-3" style={{ backgroundColor: "#F0F4FF" }}>
          <p className="text-[0.65rem] font-semibold" style={{ color: "var(--naver-blue)" }}>
            🏆 가장 호평받은 메뉴
          </p>
          <p
            className="mt-1 text-sm font-bold"
            style={{ color: "var(--naver-gray-900)" }}
          >
            {overall.bestMenu}
          </p>
          <p className="mt-0.5 text-xs" style={{ color: "var(--naver-gray-500)" }}>
            {overall.bestMenuReason}
          </p>
        </div>
        <div className="rounded-lg px-4 py-3" style={{ backgroundColor: "#FFF8F0" }}>
          <p className="text-[0.65rem] font-semibold" style={{ color: "var(--naver-amber)" }}>
            💬 가장 아쉬운 메뉴
          </p>
          <p
            className="mt-1 text-sm font-bold"
            style={{ color: "var(--naver-gray-900)" }}
          >
            {overall.worstMenu}
          </p>
          <p className="mt-0.5 text-xs" style={{ color: "var(--naver-gray-500)" }}>
            {overall.worstMenuReason}
          </p>
        </div>
      </div>

      {/* 종합 평가 코멘트 */}
      <div
        className="rounded-lg px-4 py-3"
        style={{
          backgroundColor: "white",
          border: "1px solid var(--naver-gray-200)",
        }}
      >
        <p
          className="mb-2 text-xs font-bold"
          style={{ color: "var(--naver-gray-900)" }}
        >
          🍽 종합 평가 코멘트
        </p>
        <p
          className="text-sm leading-relaxed whitespace-pre-wrap"
          style={{
            color: "var(--naver-gray-900)",
            fontStyle: "italic",
          }}
        >
          {overall.expertComment}
        </p>
      </div>
    </div>
  );
}
