"use client";

import { Download } from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";

/**
 * 리뷰 엑셀(.xlsx) 다운로드 버튼.
 * reviews-table 의 COLUMNS 순서/라벨과 동일한 시트를 생성한다.
 */

interface ExcelDownloadButtonProps {
  data: unknown[];
  fileName?: string;
}

// reviews-table.tsx COLUMNS 와 동일 순서/라벨
const COLUMNS: ReadonlyArray<{ key: string; label: string }> = [
  { key: "account", label: "계정" },
  { key: "visitDate", label: "방문일" },
  { key: "visitTime", label: "방문시간대" },
  { key: "reservation", label: "예약여부" },
  { key: "waitTime", label: "대기시간" },
  { key: "purpose", label: "방문목적" },
  { key: "companions", label: "동행" },
  { key: "keywords", label: "키워드" },
  { key: "visitCount", label: "방문횟수" },
  { key: "authMethod", label: "인증수단" },
  { key: "viewCount", label: "조회수" },
  { key: "review", label: "본문" },
];

const COL_WIDTHS: ReadonlyArray<number> = [
  10, // 계정
  14, // 방문일
  10, // 방문시간대
  10, // 예약여부
  10, // 대기시간
  10, // 방문목적
  12, // 동행
  20, // 키워드
  10, // 방문횟수
  10, // 인증수단
  8,  // 조회수
  60, // 본문
];

function toRecordArray(arr: unknown[]): Record<string, unknown>[] {
  return arr.filter(
    (item): item is Record<string, unknown> =>
      typeof item === "object" && item !== null && !Array.isArray(item),
  );
}

export function ExcelDownloadButton({
  data,
  fileName = "리뷰_데이터.xlsx",
}: ExcelDownloadButtonProps) {
  const downloadExcel = () => {
    if (!data || data.length === 0) return;

    const records = toRecordArray(data);
    if (records.length === 0) return;

    // 알려진 키 + 그 외 키도 누락 없이 모두 포함 (오른쪽 끝에 추가)
    const knownKeys = new Set(COLUMNS.map((c) => c.key));
    const extraKeys = Array.from(
      new Set(
        records.flatMap((r) => Object.keys(r)).filter((k) => !knownKeys.has(k)),
      ),
    );
    const finalCols = [
      ...COLUMNS,
      ...extraKeys.map((k) => ({ key: k, label: k })),
    ];

    // 헤더 행 + 데이터 행을 2D 배열(AoA)로 구성
    const aoa: (string | number)[][] = [];
    aoa.push(finalCols.map((c) => c.label));
    for (const r of records) {
      aoa.push(
        finalCols.map((c) => {
          const v = r[c.key];
          if (v == null) return "";
          if (typeof v === "number") return v;
          if (typeof v === "string") return v;
          return JSON.stringify(v);
        }),
      );
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = finalCols.map((_, i) => ({ wch: COL_WIDTHS[i] ?? 14 }));
    ws["!autofilter"] = { ref: ws["!ref"] ?? "A1" };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "리뷰");

    // .xlsx 가 아니면 자동으로 확장자 보정
    const safeName = fileName.toLowerCase().endsWith(".xlsx")
      ? fileName
      : fileName.replace(/\.csv$/i, "") + ".xlsx";
    XLSX.writeFile(wb, safeName);
  };

  return (
    <Button
      onClick={downloadExcel}
      variant="outline"
      size="sm"
      className="ml-auto flex items-center gap-2"
    >
      <Download className="h-4 w-4" />
      엑셀 저장
    </Button>
  );
}
