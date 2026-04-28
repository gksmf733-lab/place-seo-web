"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  jobId: string;
  reviewCount: number;
}

export function ReviewDeleteButton({ jobId, reviewCount }: Props) {
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    if (!confirm(`리뷰 ${reviewCount}건을 전체 삭제하시겠습니까? 관련 분석 결과도 함께 초기화됩니다.`)) return;

    setDeleting(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, clearAll: true }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as Record<string, string>).error || "삭제 실패");
      }

      const result = await res.json();
      toast.success(`리뷰 ${result.deleted}건 삭제 완료`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "삭제 중 오류 발생");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Button
      onClick={handleDelete}
      variant="outline"
      size="sm"
      disabled={deleting}
      className="text-red-600 border-red-200 hover:bg-red-50 flex items-center gap-2"
    >
      <Trash2 className="h-4 w-4" />
      {deleting ? "삭제 중..." : "전체 삭제"}
    </Button>
  );
}
