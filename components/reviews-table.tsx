"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type ReviewRow =
  | string
  | {
      account?: string;
      visitDate?: string;
      visitTime?: string;
      reservation?: string;
      waitTime?: string;
      purpose?: string;
      companions?: string;
      keywords?: string;
      visitCount?: string;
      authMethod?: string;
      viewCount?: string | number;
      review?: string;
      [key: string]: unknown;
    };

type CellPos = { row: number; col: number };

type ColumnDef = {
  key: string;
  label: string;
  align: "left" | "center" | "right";
  widthClass: string;
  dense: boolean;
  wrap: boolean;
};

const COLUMNS: readonly ColumnDef[] = [
  { key: "account",     label: "계정",       align: "left",   widthClass: "min-w-[6rem] w-[8%]",    dense: true,  wrap: false },
  { key: "visitDate",   label: "방문일",     align: "center", widthClass: "min-w-[8rem] w-[10%]",   dense: true,  wrap: false },
  { key: "visitTime",   label: "방문시간대", align: "center", widthClass: "min-w-[4rem] w-[5%]",    dense: true,  wrap: false },
  { key: "reservation", label: "예약여부",   align: "center", widthClass: "min-w-[5rem] w-[6%]",    dense: true,  wrap: false },
  { key: "waitTime",    label: "대기시간",   align: "center", widthClass: "min-w-[5rem] w-[6%]",    dense: true,  wrap: false },
  { key: "purpose",     label: "방문목적",   align: "center", widthClass: "min-w-[4rem] w-[5%]",    dense: true,  wrap: false },
  { key: "companions",  label: "동행",       align: "center", widthClass: "min-w-[6rem] w-[7%]",    dense: true,  wrap: true  },
  { key: "keywords",    label: "키워드",     align: "left",   widthClass: "min-w-[8rem] w-[10%]",   dense: true,  wrap: true  },
  { key: "visitCount",  label: "방문횟수",   align: "center", widthClass: "min-w-[4rem] w-[5%]",    dense: true,  wrap: false },
  { key: "authMethod",  label: "인증수단",   align: "center", widthClass: "min-w-[4rem] w-[5%]",    dense: true,  wrap: false },
  { key: "viewCount",   label: "조회수",     align: "right",  widthClass: "min-w-[3rem] w-[4%]",    dense: true,  wrap: false },
  { key: "review",      label: "본문",       align: "left",   widthClass: "min-w-[300px] w-[29%]",  dense: false, wrap: true  },
];

function cellValue(r: ReviewRow, key: ColumnDef["key"]): string {
  if (typeof r === "string") {
    return key === "review" ? r : "";
  }
  const v = (r as Record<string, unknown>)[key];
  if (v == null) return "";
  return String(v);
}

function escapeTsvCell(v: string): string {
  if (v.includes("\t") || v.includes("\n") || v.includes('"')) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

type Props = {
  reviews: unknown[];
  jobId?: string;
};

function toReviewRow(item: unknown): ReviewRow {
  if (typeof item === "string") return item;
  if (typeof item === "object" && item !== null) return item as ReviewRow;
  return String(item);
}

export function ReviewsTable({ reviews: rawReviews, jobId }: Props) {
  const reviews = rawReviews.map(toReviewRow);
  const [selStart, setSelStart] = useState<CellPos | null>(null);
  const [selEnd, setSelEnd] = useState<CellPos | null>(null);
  const [dragging, setDragging] = useState(false);
  const [checkedRows, setCheckedRows] = useState<Set<number>>(new Set());
  const [deletingRows, setDeletingRows] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const allChecked = reviews.length > 0 && checkedRows.size === reviews.length;

  const toggleAllRows = () => {
    if (allChecked) {
      setCheckedRows(new Set());
    } else {
      setCheckedRows(new Set(reviews.map((_, i) => i)));
    }
  };

  const toggleRow = (idx: number) => {
    setCheckedRows((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleDeleteSelected = async () => {
    if (!jobId || checkedRows.size === 0) return;
    if (!confirm(`선택한 ${checkedRows.size}건의 리뷰를 삭제하시겠습니까?`)) return;

    setDeletingRows(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, indices: Array.from(checkedRows) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as Record<string, string>).error || "삭제 실패");
      }
      const result = await res.json();
      toast.success(`리뷰 ${result.deleted}건 삭제 완료`);
      setCheckedRows(new Set());
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "삭제 중 오류 발생");
    } finally {
      setDeletingRows(false);
    }
  };

  // 전역 mouseup으로 드래그 종료
  useEffect(() => {
    if (!dragging) return;
    const handler = () => setDragging(false);
    window.addEventListener("mouseup", handler);
    return () => window.removeEventListener("mouseup", handler);
  }, [dragging]);

  // 테이블 바깥 클릭 시 선택 해제
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setSelStart(null);
        setSelEnd(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Ctrl+C 가로채서 선택 범위를 TSV로 복사
  useEffect(() => {
    if (!selStart || !selEnd) return;
    const handler = (e: ClipboardEvent) => {
      const r1 = Math.min(selStart.row, selEnd.row);
      const r2 = Math.max(selStart.row, selEnd.row);
      const c1 = Math.min(selStart.col, selEnd.col);
      const c2 = Math.max(selStart.col, selEnd.col);

      const lines: string[] = [];
      for (let r = r1; r <= r2; r++) {
        const cells: string[] = [];
        for (let c = c1; c <= c2; c++) {
          cells.push(escapeTsvCell(cellValue(reviews[r], COLUMNS[c].key)));
        }
        lines.push(cells.join("\t"));
      }
      const tsv = lines.join("\n");
      if (e.clipboardData) {
        e.clipboardData.setData("text/plain", tsv);
        e.preventDefault();
      }
    };
    document.addEventListener("copy", handler);
    return () => document.removeEventListener("copy", handler);
  }, [selStart, selEnd, reviews]);

  const startSelection = useCallback((row: number, col: number) => {
    setSelStart({ row, col });
    setSelEnd({ row, col });
    setDragging(true);
  }, []);

  const extendSelection = useCallback(
    (row: number, col: number) => {
      if (!dragging) return;
      setSelEnd({ row, col });
    },
    [dragging],
  );

  const isSelected = useCallback(
    (row: number, col: number) => {
      if (!selStart || !selEnd) return false;
      const r1 = Math.min(selStart.row, selEnd.row);
      const r2 = Math.max(selStart.row, selEnd.row);
      const c1 = Math.min(selStart.col, selEnd.col);
      const c2 = Math.max(selStart.col, selEnd.col);
      return row >= r1 && row <= r2 && col >= c1 && col <= c2;
    },
    [selStart, selEnd],
  );

  const showCheckbox = !!jobId;

  return (
    <div ref={containerRef} className="space-y-2">
      {/* 선택 삭제 툴바 */}
      {showCheckbox && checkedRows.size > 0 && (
        <div className="flex items-center justify-between rounded-md border bg-muted/50 px-3 py-2">
          <span className="text-xs text-muted-foreground">
            {checkedRows.size}건 선택됨
          </span>
          <Button
            onClick={handleDeleteSelected}
            variant="outline"
            size="sm"
            disabled={deletingRows}
            className="text-red-600 border-red-200 hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            {deletingRows ? "삭제 중..." : "선택 삭제"}
          </Button>
        </div>
      )}

      <div className="rounded-md border max-h-[600px] overflow-auto relative bg-background select-none">
        <table className="min-w-full border-separate border-spacing-0 text-xs">
          <thead>
            <tr>
              {showCheckbox && (
                <th className="sticky top-0 left-0 z-30 w-10 min-w-[2.5rem] border-r border-b bg-secondary/95 backdrop-blur-sm px-2 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={toggleAllRows}
                    className="h-3.5 w-3.5 rounded border-gray-300 accent-[var(--naver-green)] cursor-pointer"
                  />
                </th>
              )}
              <th className={`sticky top-0 ${showCheckbox ? "" : "left-0"} z-30 w-12 min-w-[3rem] border-r border-b bg-secondary/95 backdrop-blur-sm px-3 py-2 text-center font-semibold text-muted-foreground uppercase`}>
                #
              </th>
              {COLUMNS.map((c) => {
                const alignClass =
                  c.align === "right"
                    ? "text-right"
                    : c.align === "center"
                      ? "text-center"
                      : "text-left";
                return (
                  <th
                    key={c.key}
                    className={`sticky top-0 z-20 border-r border-b bg-secondary/95 backdrop-blur-sm px-3 py-2 font-semibold text-muted-foreground uppercase ${c.widthClass} ${alignClass}`}
                  >
                    {c.label}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {reviews.map((r, rowIdx) => {
              const rowBg = rowIdx % 2 === 0 ? "bg-background" : "bg-muted/40";
              const rowChecked = checkedRows.has(rowIdx);
              return (
                <tr key={rowIdx} className={rowBg}>
                  {showCheckbox && (
                    <td
                      className={`${showCheckbox ? "sticky left-0 z-10" : ""} w-10 min-w-[2.5rem] border-r border-b px-2 py-2 text-center ${rowBg}`}
                    >
                      <input
                        type="checkbox"
                        checked={rowChecked}
                        onChange={() => toggleRow(rowIdx)}
                        className="h-3.5 w-3.5 rounded border-gray-300 accent-[var(--naver-green)] cursor-pointer"
                      />
                    </td>
                  )}
                  <td
                    className={`${showCheckbox ? "" : "sticky left-0 z-10"} w-12 min-w-[3rem] border-r border-b px-3 py-2 text-center font-mono text-[0.7rem] text-muted-foreground tabular-nums ${rowBg}`}
                  >
                    {rowIdx + 1}
                  </td>
                  {COLUMNS.map((c, colIdx) => {
                    const v = cellValue(r, c.key);
                    const selected = isSelected(rowIdx, colIdx);
                    const alignClass =
                      c.align === "right"
                        ? "text-right"
                        : c.align === "center"
                          ? "text-center"
                          : "text-left";
                    const fontClass = c.dense
                      ? "font-mono text-[0.7rem] tabular-nums"
                      : "";
                    const wrapClass = c.wrap
                      ? "whitespace-pre-wrap"
                      : "whitespace-nowrap";
                    const bgClass = selected ? "!bg-primary/25" : "";
                    return (
                      <td
                        key={c.key}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          startSelection(rowIdx, colIdx);
                        }}
                        onMouseEnter={() => extendSelection(rowIdx, colIdx)}
                        className={`border-r border-b px-3 py-2 align-top cursor-cell text-foreground ${alignClass} ${fontClass} ${wrapClass} ${bgClass}`}
                      >
                        {v || "-"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        {selStart && selEnd && (
          <div
            className="sticky bottom-0 left-0 right-0 z-40 border-t bg-secondary/95 backdrop-blur-sm px-3 py-1.5 text-[0.7rem] text-muted-foreground"
            aria-live="polite"
          >
            선택 범위: {Math.abs(selEnd.row - selStart.row) + 1}행 ×{" "}
            {Math.abs(selEnd.col - selStart.col) + 1}열 · Ctrl+C로 복사 (Excel 붙여넣기 호환)
          </div>
        )}
      </div>
    </div>
  );
}
