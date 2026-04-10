"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type CopyButtonProps = {
  text: string;
  label?: string;
  copiedLabel?: string;
};

export function CopyButton({
  text,
  label = "프롬프트 복사",
  copiedLabel = "복사됨",
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("복사되었습니다");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("복사에 실패했습니다");
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onCopy}
      aria-live="polite"
    >
      {copied ? copiedLabel : label}
    </Button>
  );
}
