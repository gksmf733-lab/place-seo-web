"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function SeedButton() {
  const router = useRouter();
  const [running, setRunning] = useState(false);

  async function onClick() {
    if (running) return;
    setRunning(true);
    try {
      const res = await fetch("/api/prompts/seed", { method: "POST" });
      const data = (await res.json()) as {
        ok?: boolean;
        created?: number;
        skipped?: number;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "seed 실패");
      }
      if ((data.created ?? 0) > 0) {
        toast.success(`${data.created}개 프롬프트를 추가했습니다`);
      } else {
        toast.info("이미 프롬프트가 있어 seed를 건너뛰었습니다");
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "seed 실패");
    } finally {
      setRunning(false);
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={onClick}
      disabled={running}
    >
      {running ? "seed 중..." : "YAML에서 seed"}
    </Button>
  );
}
