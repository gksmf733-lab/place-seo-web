"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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
import type { ReviewIntro } from "@/lib/jobs";

type PromptOption = {
  id: string;
  name: string;
  description: string;
  guide: string;
  isDefault: boolean;
};

type Props = {
  jobId: string;
  hasAnalysis: boolean;
  prompts: PromptOption[];
  initialIntro: ReviewIntro | null;
};

function formatDate(iso?: string): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("ko-KR");
  } catch {
    return iso;
  }
}

export function ReviewIntroPanel({
  jobId,
  hasAnalysis,
  prompts,
  initialIntro,
}: Props) {
  const router = useRouter();
  const defaultPromptId =
    initialIntro?.promptId ??
    prompts.find((p) => p.isDefault)?.id ??
    prompts[0]?.id ??
    "";

  const [selectedId, setSelectedId] = useState<string>(defaultPromptId);
  const [intro, setIntro] = useState<ReviewIntro | null>(initialIntro);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  const selected = prompts.find((p) => p.id === selectedId);
  const busy = loading || isPending;

  async function onGenerate() {
    if (!selectedId) {
      toast.error("사용할 프롬프트를 먼저 선택하세요.");
      return;
    }
    if (!hasAnalysis) {
      toast.error("먼저 상단의 '리뷰 AI 분석'을 실행해 주세요.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/reviews/intro?jobId=${encodeURIComponent(jobId)}&promptId=${encodeURIComponent(selectedId)}`,
        { method: "POST" },
      );
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "생성 실패", { description: json.details });
        return;
      }
      setIntro(json.intro);
      toast.success("업체 소개글이 생성되었습니다.");
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
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle>✍ 리뷰 기반 상세설명</CardTitle>
          <CardDescription>
            리뷰 AI 분석 결과(종합요약·강점·키워드·페르소나·원본리뷰)가 자동으로
            컨텍스트에 주입됩니다. 프롬프트에는 <strong>톤/분량/스타일 가이드만</strong>
            작성하면 됩니다.
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {prompts.length === 0 ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <p className="mb-2">
              <strong>review_intro</strong> 섹션 프롬프트가 아직 없습니다.
            </p>
            <Button
              render={<Link href="/admin/prompts" />}
              variant="outline"
              size="sm"
            >
              프롬프트 관리에서 등록하기 →
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <label
                  htmlFor="review-intro-prompt"
                  className="text-xs text-muted-foreground"
                >
                  프롬프트:
                </label>
                <select
                  id="review-intro-prompt"
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  disabled={busy}
                  className="h-8 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  {prompts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.isDefault ? " (기본)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                variant="outline"
                size="sm"
                render={<Link href="/admin/prompts" />}
              >
                프롬프트 관리 →
              </Button>
            </div>

            {selected?.guide && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  작성 가이드
                </p>
                <pre className="rounded-md border bg-muted/40 px-4 py-3 text-xs whitespace-pre-wrap">
                  {selected.guide}
                </pre>
              </div>
            )}

            <div className="flex items-center justify-end">
              <Button onClick={onGenerate} disabled={busy || !hasAnalysis}>
                {busy
                  ? "생성 중…"
                  : intro
                    ? "🪄 업체소개글 재생성"
                    : "🪄 업체소개글 생성"}
              </Button>
            </div>

            {!hasAnalysis && (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                ⚠ 먼저 위의 <strong>&quot;리뷰 AI 분석&quot;</strong>을 실행해
                주세요.
              </p>
            )}

            {intro && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">
                    생성된 소개글
                  </p>
                  <CopyButton text={intro.text} label="소개글 복사" />
                </div>
                <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed">
                  {intro.text}
                </div>
                <p className="text-[0.65rem] text-muted-foreground">
                  생성 {formatDate(intro.generatedAt)} · 프롬프트{" "}
                  <span className="font-mono">{intro.promptName}</span> · 모델{" "}
                  <span className="font-mono">{intro.model}</span>
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
