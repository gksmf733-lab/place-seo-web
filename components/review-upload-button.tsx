"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import * as XLSX from "xlsx";

const HEADER_MAP: Record<string, string> = {
  "리뷰 내용": "review",
  "리뷰": "review",
  review: "review",
  방문일: "visitedAt",
  visitedat: "visitedAt",
  작성일: "createdAt",
  createdat: "createdAt",
  조회수: "viewCount",
  viewcount: "viewCount",
  키워드: "keywords",
  keywords: "keywords",
};

const DEFAULT_KEYS = ["review", "visitedAt", "createdAt", "viewCount", "keywords"] as const;

function mapHeaders(rawHeaders: string[]): (string | null)[] {
  return rawHeaders.map((h) => {
    const normalized = String(h).trim().toLowerCase();
    return HEADER_MAP[normalized] ?? null;
  });
}

interface Props {
  placeId: string;
}

export function ReviewUploadButton({ placeId }: Props) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      if (raw.length < 2) {
        toast.error("데이터가 없습니다. 헤더 행과 1건 이상의 데이터가 필요합니다.");
        return;
      }

      const headerRow = (raw[0] as string[]).map(String);
      let mapped = mapHeaders(headerRow);

      // 매핑 실패 시 positional fallback
      const matchedCount = mapped.filter(Boolean).length;
      if (matchedCount === 0) {
        mapped = headerRow.map((_, i) => (i < DEFAULT_KEYS.length ? DEFAULT_KEYS[i] : null));
      }

      const rows = raw.slice(1).filter((r) => r.some((c) => c != null && String(c).trim() !== ""));
      const reviews = rows.map((row) => {
        const obj: Record<string, unknown> = {};
        row.forEach((cell, i) => {
          const key = mapped[i];
          if (key) obj[key] = cell != null ? String(cell) : "";
        });
        return obj;
      });

      if (reviews.length === 0) {
        toast.error("업로드할 리뷰 데이터가 없습니다.");
        return;
      }

      if (reviews.length > 5000) {
        if (!confirm(`${reviews.length}건의 데이터가 감지되었습니다. 계속 진행하시겠습니까?`)) return;
      }

      const res = await fetch(`/api/reviews?placeId=${encodeURIComponent(placeId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId, reviews }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as Record<string, string>).error || "업로드 실패");
      }

      const result = await res.json();
      toast.success(`리뷰 ${result.added}건 추가 (중복 ${result.duplicates}건 제외, 총 ${result.total}건)`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "엑셀 파싱 중 오류가 발생했습니다.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <Button
        onClick={() => inputRef.current?.click()}
        variant="outline"
        size="sm"
        disabled={uploading}
        className="flex items-center gap-2"
      >
        <Upload className="h-4 w-4" />
        {uploading ? "업로드 중..." : "엑셀 업로드"}
      </Button>
    </>
  );
}
