"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type FeatureCheck = {
  key: string;
  label: string;
  active: boolean;
  evidence: string[];
};

type ProbeResult = {
  placeId: string;
  homeUrl: string;
  generatedAt: string;
  features: FeatureCheck[];
};

type Props = {
  placeId: string | null;
};

export function ProbePanel({ placeId }: Props) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ProbeResult | null>(null);

  async function onClick() {
    if (!placeId) {
      toast.error("Place ID가 없습니다. 먼저 스크래핑을 실행해 주세요.");
      return;
    }
    if (running) return;
    setRunning(true);
    toast.info("부가서비스 체크를 시작합니다. 약 30초~1분 소요.");
    try {
      const res = await fetch(`/api/probe/${encodeURIComponent(placeId)}`, {
        method: "POST",
      });
      const data = (await res.json()) as {
        ok?: boolean;
        data?: ProbeResult;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.data) {
        throw new Error(data.error ?? "체크 실패");
      }
      setResult(data.data);
      toast.success("부가서비스 체크가 완료되었습니다.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "체크 실패");
    } finally {
      setRunning(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle>부가서비스 활성 체크</CardTitle>
          <CardDescription>
            예약 · 톡톡 · 쿠폰 · 네이버페이 · 스마트콜 · 소식 · 사진리뷰 등
            네이버 플레이스 부가기능의 활성 여부를 실시간 확인합니다.
          </CardDescription>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClick}
          disabled={running || !placeId}
        >
          {running ? "확인 중..." : "부가서비스 확인"}
        </Button>
      </CardHeader>
      {result && (
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {new Date(result.generatedAt).toLocaleString("ko-KR")} 기준
          </p>
          <ul className="divide-y rounded-md border">
            {result.features.map((f) => (
              <li
                key={f.key}
                className="flex items-start gap-3 px-4 py-3 text-sm"
              >
                <span
                  className={
                    "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold " +
                    (f.active
                      ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                      : "bg-muted text-muted-foreground")
                  }
                  aria-label={f.active ? "활성" : "비활성"}
                >
                  {f.active ? "✓" : "–"}
                </span>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{f.label}</span>
                    <span
                      className={
                        "text-xs " +
                        (f.active
                          ? "text-green-700 dark:text-green-300"
                          : "text-muted-foreground")
                      }
                    >
                      {f.active ? "활성" : "비활성"}
                    </span>
                  </div>
                  {f.active && f.evidence.length > 0 && (
                    <ul className="space-y-0.5 text-xs text-muted-foreground">
                      {f.evidence.map((e, i) => (
                        <li key={i} className="break-all font-mono">
                          {e}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      )}
    </Card>
  );
}
