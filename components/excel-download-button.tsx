"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ExcelDownloadButtonProps {
  data: any[];
  fileName?: string;
}

export function ExcelDownloadButton({ data, fileName = "리뷰_데이터.csv" }: ExcelDownloadButtonProps) {
  const downloadExcel = () => {
    if (!data || data.length === 0) return;

    // 모든 키를 수집하여 컬럼 헤더 생성
    const headers = Array.from(new Set(data.flatMap(item => Object.keys(item))));
    
    // CSV 헤더 행 추가
    let csvContent = "\uFEFF"; // 한글 깨짐 방지용 BOM
    csvContent += headers.join(",") + "\r\n";

    // 데이터 행 추가
    data.forEach(item => {
      const row = headers.map(header => {
        let val = item[header] ?? "";
        // 줄바꿈이나 콤마가 있으면 쌍따옴표로 감쌈
        if (typeof val === "string") {
          val = val.replace(/"/g, '""'); // 따옴표 이스케이프
          if (val.search(/("|,|\n)/g) >= 0) {
            val = `"${val}"`;
          }
        }
        return val;
      });
      csvContent += row.join(",") + "\r\n";
    });

    // 다운로드 트리거
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Button 
      onClick={downloadExcel} 
      variant="outline" 
      size="sm"
      className="ml-auto flex items-center gap-2"
    >
      <Download className="h-4 w-4" />
      엑셀 (CSV) 저장
    </Button>
  );
}
