"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { MenuEvaluation, MenuEvalItem } from "@/lib/jobs";

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
}: Props) {
  const router = useRouter();
  const [evaluation, setEvaluation] = useState<MenuEvaluation | null>(
    initialEvaluation,
  );
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

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

  function toggleExpand(idx: number) {
    setExpandedIdx((prev) => (prev === idx ? null : idx));
  }

  return (
    <div
      className="overflow-hidden rounded-xl bg-white shadow-sm ring-1"
      style={{
        borderLeft: "3px solid var(--naver-green)",
        borderColor: "var(--naver-gray-200)",
      }}
    >
      {/* 헤더 */}
      <div
        className="flex items-center justify-between gap-4 border-b px-5 py-3"
        style={{ borderColor: "var(--naver-gray-200)" }}
      >
        <div>
          <h3
            className="text-sm font-bold"
            style={{ color: "var(--naver-gray-900)" }}
          >
            메뉴별 리뷰 평가 ({menus.length}건)
          </h3>
          {evaluation && (
            <p className="mt-0.5 text-[0.65rem]" style={{ color: "var(--naver-gray-500)" }}>
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
          {busy
            ? "분석 중…"
            : evaluation
              ? "재분석"
              : "메뉴 평가 생성"}
        </Button>
      </div>

      {/* 메뉴 리스트 */}
      <div className="divide-y" style={{ borderColor: "var(--naver-gray-200)" }}>
        {menus.map((menu, idx) => {
          const evalItem = evalMap.get(menu.name);
          const isExpanded = expandedIdx === idx;
          const hasEval =
            evalItem &&
            (evalItem.strengths.length > 0 ||
              evalItem.weaknesses.length > 0 ||
              evalItem.needsImprovement);

          return (
            <div key={idx}>
              {/* 메뉴 행 */}
              <button
                type="button"
                onClick={() => evaluation && toggleExpand(idx)}
                className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-[var(--naver-gray-50)]"
                disabled={!evaluation}
              >
                {/* 번호 */}
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[0.65rem] font-bold"
                  style={{
                    backgroundColor: "var(--naver-green-50)",
                    color: "var(--naver-green-dark)",
                  }}
                >
                  {idx + 1}
                </span>

                {/* 메뉴 정보 */}
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

                {/* 가격 */}
                <span
                  className="shrink-0 rounded-md px-2.5 py-1 text-xs font-bold"
                  style={{
                    backgroundColor: "var(--naver-green-50)",
                    color: "var(--naver-green-dark)",
                  }}
                >
                  {menu.price}
                </span>

                {/* 평가 상태 인디케이터 */}
                {evaluation && (
                  <span className="shrink-0 text-xs">
                    {hasEval ? (
                      isExpanded ? "▲" : "▼"
                    ) : (
                      <span style={{ color: "var(--naver-gray-200)" }}>—</span>
                    )}
                  </span>
                )}
              </button>

              {/* 드롭다운 평가 내용 */}
              {isExpanded && evalItem && (
                <div
                  className="border-t px-5 py-4 space-y-3"
                  style={{
                    backgroundColor: "var(--naver-gray-50)",
                    borderColor: "var(--naver-gray-200)",
                  }}
                >
                  {/* 강점 */}
                  {evalItem.strengths.length > 0 && (
                    <div>
                      <p
                        className="mb-1.5 text-xs font-bold"
                        style={{ color: "var(--naver-green-dark)" }}
                      >
                        ◆ 고객이 뽑은 강점
                      </p>
                      <ul className="space-y-1">
                        {evalItem.strengths.map((s, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 rounded-md px-3 py-2 text-xs"
                            style={{ backgroundColor: "var(--naver-green-50)" }}
                          >
                            <span style={{ color: "var(--naver-green)" }}>✓</span>
                            <span style={{ color: "var(--naver-gray-900)" }}>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 단점 */}
                  {evalItem.weaknesses.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-xs font-bold" style={{ color: "var(--naver-red)" }}>
                        ▲ 고객이 지적한 단점
                      </p>
                      <ul className="space-y-1">
                        {evalItem.weaknesses.map((w, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-xs"
                          >
                            <span style={{ color: "var(--naver-red)" }}>✗</span>
                            <span style={{ color: "var(--naver-gray-900)" }}>{w}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 개선 필요 여부 */}
                  <div
                    className="rounded-md px-3 py-2.5 text-xs"
                    style={{
                      backgroundColor: evalItem.needsImprovement
                        ? "#FFF3E0"
                        : "var(--naver-green-50)",
                    }}
                  >
                    <span className="font-bold" style={{
                      color: evalItem.needsImprovement
                        ? "var(--naver-amber)"
                        : "var(--naver-green-dark)",
                    }}>
                      {evalItem.needsImprovement
                        ? "⚠ 개선 필요"
                        : "✓ 개선 불필요"}
                    </span>
                    {evalItem.needsImprovement &&
                      evalItem.improvementSuggestion && (
                        <p className="mt-1.5" style={{ color: "var(--naver-gray-900)" }}>
                          <span className="font-semibold">개선 방향: </span>
                          {evalItem.improvementSuggestion}
                        </p>
                      )}
                  </div>

                  {/* 리뷰 미언급 */}
                  {evalItem.strengths.length === 0 &&
                    evalItem.weaknesses.length === 0 && (
                      <p
                        className="py-2 text-center text-xs"
                        style={{ color: "var(--naver-gray-500)" }}
                      >
                        이 메뉴에 대한 리뷰 언급이 없습니다.
                      </p>
                    )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!hasReviews && (
        <div className="px-5 py-6 text-center text-xs" style={{ color: "var(--naver-gray-500)" }}>
          리뷰 데이터가 없어 메뉴 평가를 생성할 수 없습니다.
        </div>
      )}
    </div>
  );
}
