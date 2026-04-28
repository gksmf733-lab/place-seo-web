"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  jobId: string;
}

export function ReviewCrawlButton({ jobId }: Props) {
  const [crawling, setCrawling] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const router = useRouter();

  // 마운트 시 크롤러 헬스체크
  useEffect(() => {
    fetch("/api/reviews/crawl")
      .then((r) => r.json())
      .then((d) => setAvailable(d.available === true))
      .catch(() => setAvailable(false));
  }, []);

  const handleCrawl = async () => {
    if (!confirm("리뷰 수집을 시작하시겠습니까? IP 회전 포함 2~3분 소요될 수 있습니다.")) return;

    setCrawling(true);
    toast.info("리뷰를 수집하고 있습니다. 잠시 기다려주세요...");

    try {
      const res = await fetch("/api/reviews/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, maxReviews: 200 }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as Record<string, string>).error || "수집 실패");
      }

      const result = await res.json();
      toast.success(
        `리뷰 ${result.crawled}건 수집, ${result.added}건 추가 (총 ${result.total}건)`,
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "리뷰 수집 중 오류 발생");
    } finally {
      setCrawling(false);
    }
  };

  return (
    <Button
      onClick={handleCrawl}
      variant="outline"
      size="sm"
      disabled={crawling || available === false}
      title={available === false ? "크롤러에 연결할 수 없습니다 (localhost:3003)" : undefined}
      className="flex items-center gap-2"
    >
      <Search className="h-4 w-4" />
      {crawling
        ? "수집 중..."
        : available === false
          ? "크롤러 미연결"
          : "리뷰 수집"}
    </Button>
  );
}
