"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, RefreshCw, Shuffle, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  jobId: string;
  placeUrl: string;
}

type HealthData = {
  available: boolean;
  adbDevices?: string[];
  activeJobs?: number;
};

type Step = "idle" | "ip" | "page" | "load" | "extract" | "done" | "error";

const STEPS: { key: Step; label: string }[] = [
  { key: "ip", label: "1. IP 변경" },
  { key: "page", label: "2. 페이지 진입" },
  { key: "load", label: "3. 리뷰 로드" },
  { key: "extract", label: "4. 데이터 추출" },
];

const MAX_OPTIONS = [
  { value: 10, label: "10개" },
  { value: 50, label: "50개" },
  { value: 100, label: "100개" },
  { value: 200, label: "200개" },
  { value: 300, label: "300개" },
  { value: 500, label: "500개" },
];

export function ReviewCrawlPanel({ jobId, placeUrl }: Props) {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [ip, setIp] = useState<string | null>(null);
  const [ipLoading, setIpLoading] = useState(false);
  const [ipRotating, setIpRotating] = useState(false);
  const [maxReviews, setMaxReviews] = useState(100);
  const [rotateIp, setRotateIp] = useState(true);
  const [crawling, setCrawling] = useState(false);
  const [step, setStep] = useState<Step>("idle");
  const router = useRouter();

  // 헬스체크
  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/reviews/crawl");
      const data: HealthData = await res.json();
      setHealth(data);
    } catch {
      setHealth({ available: false });
    }
  }, []);

  // IP 조회
  const refreshIp = useCallback(async () => {
    setIpLoading(true);
    try {
      const res = await fetch("/api/reviews/crawl/ip");
      const data = await res.json();
      setIp(data.ip || null);
    } catch {
      setIp(null);
    } finally {
      setIpLoading(false);
    }
  }, []);

  // IP 수동 변경
  const handleRotateIp = async () => {
    setIpRotating(true);
    try {
      const res = await fetch("/api/reviews/crawl/ip", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setIp(data.newIp);
        toast.success(`IP 변경: ${data.oldIp} → ${data.newIp}`);
      } else {
        toast.error(data.error || "IP 변경 실패");
      }
    } catch {
      toast.error("IP 변경 요청 실패");
    } finally {
      setIpRotating(false);
    }
  };

  // 크롤링 실행
  const handleCrawl = async () => {
    setCrawling(true);
    setStep(rotateIp ? "ip" : "page");

    // 시뮬레이션: 단계별 진행 표시
    const stepTimer = (s: Step, delay: number) =>
      new Promise<void>((resolve) => setTimeout(() => { setStep(s); resolve(); }, delay));

    try {
      // 비동기로 크롤링 요청
      const crawlPromise = fetch("/api/reviews/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, maxReviews, rotateIpBefore: rotateIp }),
      });

      // 진행 단계 시뮬레이션 (크롤러가 실제 단계 콜백을 지원하지 않으므로)
      if (rotateIp) {
        await stepTimer("page", 12000);
      }
      await stepTimer("load", 3000);
      await stepTimer("extract", 5000);

      const res = await crawlPromise;
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as Record<string, string>).error || "수집 실패");
      }

      const result = await res.json();
      setStep("done");
      toast.success(
        `리뷰 ${result.crawled}건 수집, ${result.added}건 추가 (총 ${result.total}건)`,
      );

      // IP가 변경됐을 수 있으니 갱신
      refreshIp();
      router.refresh();
    } catch (err) {
      setStep("error");
      toast.error(err instanceof Error ? err.message : "리뷰 수집 중 오류 발생");
    } finally {
      setCrawling(false);
    }
  };

  // 마운트 시 체크
  useEffect(() => {
    checkHealth();
    refreshIp();
  }, [checkHealth, refreshIp]);

  const phoneCount = health?.adbDevices?.length ?? 0;
  const connected = health?.available === true && phoneCount > 0;

  return (
    <div className="space-y-4">
      {/* ── 폰 연결 상태 ── */}
      <div className="rounded-lg border bg-muted/30 px-5 py-4">
        <p className="text-xs font-medium text-muted-foreground mb-3">폰 연결 상태</p>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${
                connected
                  ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"
                  : "bg-red-400"
              }`}
            />
            <Smartphone className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              {health === null
                ? "확인 중..."
                : connected
                  ? `폰 연결됨 (${phoneCount}대)`
                  : "폰 미연결"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm px-3 py-1.5 rounded-md bg-background border text-blue-500">
              {ipLoading ? "조회 중..." : ip ? `IP: ${ip}` : "IP: -"}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshIp}
              disabled={ipLoading}
              className="gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${ipLoading ? "animate-spin" : ""}`} />
              IP 확인
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRotateIp}
              disabled={ipRotating || !connected}
              className="gap-1.5"
            >
              <Shuffle className={`h-3.5 w-3.5 ${ipRotating ? "animate-spin" : ""}`} />
              {ipRotating ? "변경 중..." : "IP 변경"}
            </Button>
          </div>
        </div>
      </div>

      {/* ── 리뷰 수집 폼 ── */}
      <div className="rounded-lg border bg-muted/30 px-5 py-4 space-y-4">
        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <Search className="h-3.5 w-3.5" />
          리뷰 수집
        </p>

        {/* URL + 수집 개수 */}
        <div className="flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-[280px]">
            <label className="text-xs text-muted-foreground mb-1.5 block">네이버 플레이스 URL</label>
            <div className="font-mono text-sm px-3 py-2.5 rounded-md bg-background border text-foreground truncate">
              {placeUrl || "-"}
            </div>
          </div>
          <div className="w-32">
            <label className="text-xs text-muted-foreground mb-1.5 block">수집 개수</label>
            <select
              value={maxReviews}
              onChange={(e) => setMaxReviews(Number(e.target.value))}
              disabled={crawling}
              className="w-full px-3 py-2.5 rounded-md bg-background border text-sm text-foreground"
            >
              {MAX_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* IP 자동 변경 체크박스 */}
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={rotateIp}
            onChange={(e) => setRotateIp(e.target.checked)}
            disabled={crawling}
            className="h-4 w-4 rounded accent-emerald-500"
          />
          크롤링 전에 IP 자동 변경 (권장)
        </label>

        {/* 수집 시작 버튼 */}
        <Button
          onClick={handleCrawl}
          disabled={crawling || !connected}
          className="w-full py-6 text-base font-bold bg-emerald-500 hover:bg-emerald-600 text-white"
        >
          {crawling ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              수집 중...
            </>
          ) : (
            "▶ 리뷰 수집 시작"
          )}
        </Button>

        {/* 진행 단계 */}
        {step !== "idle" && (
          <div className="grid grid-cols-4 gap-2">
            {STEPS.map((s) => {
              const stepIdx = STEPS.findIndex((x) => x.key === s.key);
              const currentIdx = STEPS.findIndex((x) => x.key === step);
              const isDone = step === "done" || (currentIdx > stepIdx);
              const isActive = step === s.key;
              const isError = step === "error" && isActive;

              let cls = "rounded-md border px-2 py-2 text-center text-xs transition-all ";
              if (isError) {
                cls += "border-red-400 text-red-400";
              } else if (isDone) {
                cls += "border-emerald-500 text-emerald-500 bg-emerald-500/10";
              } else if (isActive) {
                cls += "border-emerald-500 text-emerald-500";
              } else {
                cls += "border-border text-muted-foreground";
              }

              return (
                <div key={s.key} className={cls}>
                  {s.label}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
