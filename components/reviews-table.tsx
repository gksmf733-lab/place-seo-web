"use client";

import { useState, useEffect, useCallback, useRef } from "react";

type ReviewRow =
  | string
  | {
      review?: string;
      visitedAt?: string;
      createdAt?: string;
      viewCount?: string | number;
      keywords?: string;
      [key: string]: unknown;
    };

type CellPos = { row: number; col: number };

type ColumnDef = {
  key: "review" | "visitedAt" | "createdAt" | "viewCount" | "keywords";
  label: string;
  align: "left" | "center" | "right";
  widthClass: string;
  dense: boolean; // 날짜/숫자는 모노스페이스 + 작게
  wrap: boolean;
};

const COLUMNS: readonly ColumnDef[] = [
  {
    key: "review",
    label: "리뷰 내용",
    align: "left",
    widthClass: "min-w-[360px] w-[42%]",
    dense: false,
    wrap: true,
  },
  {
    key: "visitedAt",
    label: "방문일",
    align: "center",
    widthClass: "w-28 min-w-[7rem]",
    dense: true,
    wrap: false,
  },
  {
    key: "createdAt",
    label: "작성일",
    align: "center",
    widthClass: "w-28 min-w-[7rem]",
    dense: true,
    wrap: false,
  },
  {
    key: "viewCount",
    label: "조회수",
    align: "right",
    widthClass: "w-20 min-w-[5rem]",
    dense: true,
    wrap: false,
  },
  {
    key: "keywords",
    label: "키워드",
    align: "left",
    widthClass: "min-w-[180px] w-[22%]",
    dense: true,
    wrap: true,
  },
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
};

function toReviewRow(item: unknown): ReviewRow {
  if (typeof item === "string") return item;
  if (typeof item === "object" && item !== null) return item as ReviewRow;
  return String(item);
}

export function ReviewsTable({ reviews: rawReviews }: Props) {
  const reviews = rawReviews.map(toReviewRow);
  const [selStart, setSelStart] = useState<CellPos | null>(null);
  const [selEnd, setSelEnd] = useState<CellPos | null>(null);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  return (
    <div
      ref={containerRef}
      className="rounded-md border max-h-[600px] overflow-auto relative bg-background select-none"
    >
      <table className="min-w-full border-separate border-spacing-0 text-xs">
        <thead>
          <tr>
            <th className="sticky top-0 left-0 z-30 w-12 min-w-[3rem] border-r border-b bg-secondary/95 backdrop-blur-sm px-3 py-2 text-center font-semibold text-muted-foreground uppercase">
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
            return (
              <tr key={rowIdx} className={rowBg}>
                <td
                  className={`sticky left-0 z-10 w-12 min-w-[3rem] border-r border-b px-3 py-2 text-center font-mono text-[0.7rem] text-muted-foreground tabular-nums ${rowBg}`}
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
                  const bgClass = selected
                    ? "!bg-primary/25"
                    : "";
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
  );
}
