"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type Props = {
  jobId: string;
  label?: string;
};

export function RescrapeButton({ jobId, label = "스크래핑 재실행" }: Props) {
  const router = useRouter();
  const [running, setRunning] = useState(false);

  async function onClick() {
    if (running) return;
    setRunning(true);
    toast.info("스크래핑을 시작합니다. 최대 1~2분 걸릴 수 있어요.");
    try {
      const res = await fetch(`/api/scrape/${encodeURIComponent(jobId)}`, {
        method: "POST",
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "재스크래핑 실패");
      }
      toast.success("스크래핑이 완료되었습니다.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "재스크래핑 실패");
    } finally {
      setRunning(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={running}
    >
      {running ? "스크래핑 중..." : label}
    </Button>
  );
}
