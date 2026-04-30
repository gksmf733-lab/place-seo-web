"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/**
 * 페이지 마운트 직후 한 번만 print 다이얼로그를 띄운다.
 * 사용자가 취소하거나 저장한 뒤 다시 인쇄하고 싶으면 버튼으로 재실행 가능.
 */
export function PrintTrigger() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 350);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="no-print fixed bottom-6 right-6 z-50 flex gap-2">
      <Button variant="outline" onClick={() => window.close()}>
        닫기
      </Button>
      <Button onClick={() => window.print()}>다시 인쇄 / PDF 저장</Button>
    </div>
  );
}
