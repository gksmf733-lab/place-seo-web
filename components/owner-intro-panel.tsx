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
import { CopyButton } from "@/components/copy-button";
import type { OwnerIntro } from "@/lib/jobs";

type Props = {
  jobId: string;
  hasAnalysis: boolean;
  initialIntro: OwnerIntro | null;
};

function formatDate(iso?: string): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("ko-KR");
  } catch {
    return iso;
  }
}

export function OwnerIntroPanel({ jobId, hasAnalysis, initialIntro }: Props) {
  const router = useRouter();
  const [intro, setIntro] = useState<OwnerIntro | null>(initialIntro);
  const [guide, setGuide] = useState<string>(initialIntro?.guide ?? "");
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  const busy = loading || isPending;

  async function onGenerate() {
    if (!hasAnalysis) {
      toast.error("먼저 '리뷰 AI 분석'을 실행해 주세요.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/reviews/owner-intro?jobId=${encodeURIComponent(jobId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ guide }),
        },
      );
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "생성 실패", { description: json.details });
        return;
      }
      setIntro(json.intro);
      toast.success("사장님 소개글이 생성되었습니다.");
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error("네트워크 오류", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle>🧑‍🍳 사장님 목소리 업체 소개글</CardTitle>
        <CardDescription>
          리뷰·분석 결과를 <strong>본인 매장에 자신있는 사장님</strong>의
          1인칭 시점으로 풀어냅니다. 어투는 <code>~어요 / ~입니다</code> 혼용 ·
          분량 500~1000자.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {!hasAnalysis && (
          <p className="text-xs text-amber-700 dark:text-amber-300">
            ⚠ 먼저 위의 <strong>&quot;리뷰 AI 분석&quot;</strong>을 실행해 주세요.
          </p>
        )}

        <div className="space-y-2">
          <label
            htmlFor="owner-intro-guide"
            className="text-xs font-medium text-muted-foreground"
          >
            업체 소개글 전용 프롬프트 가이드 (선택)
          </label>
          <textarea
            id="owner-intro-guide"
            value={guide}
            onChange={(e) => setGuide(e.target.value)}
            disabled={busy}
            rows={4}
            placeholder={
              "예) 시그니처 메뉴는 '관자 오일 파스타' 중심으로 소개해줘. 연인/가족 방문객 맞이하는 톤을 조금 더 강조해줘. 인덕원역 근처라는 점도 살짝 언급해줘."
            }
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-[0.65rem] text-muted-foreground">
              어투·분량 기본 규칙 위에 추가로 적용됩니다. 충돌 시 기본 규칙이 우선.
            </p>
            <Button onClick={onGenerate} disabled={busy || !hasAnalysis}>
              {busy
                ? "작성 중…"
                : intro
                  ? "🪄 재생성"
                  : "🪄 사장님 소개글 생성"}
            </Button>
          </div>
        </div>

        {intro ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">
                생성된 소개글
              </p>
              <CopyButton text={intro.text} label="소개글 복사" />
            </div>
            <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
              {intro.text}
            </div>
            <p className="text-[0.65rem] text-muted-foreground">
              생성 {formatDate(intro.generatedAt)} · 모델{" "}
              <span className="font-mono">{intro.model}</span>
            </p>
          </div>
        ) : (
          hasAnalysis && (
            <p className="text-sm text-muted-foreground">
              상단 <strong>&quot;사장님 소개글 생성&quot;</strong> 버튼을 누르면
              리뷰와 분석 결과를 바탕으로 사장님 1인칭 소개글을 작성합니다.
            </p>
          )
        )}
      </CardContent>
    </Card>
  );
}
