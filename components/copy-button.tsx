"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type CopyButtonProps = {
  text?: string;
  value?: string;
  label?: string;
  copiedLabel?: string;
  iconOnly?: boolean;
};

export function CopyButton({
  text,
  value,
  label = "복사",
  copiedLabel = "복사됨",
  iconOnly = false,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const payload = text ?? value ?? "";

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(payload);
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
      size={iconOnly ? "icon-xs" : "sm"}
      onClick={onCopy}
      aria-live="polite"
      aria-label={iconOnly ? (copied ? copiedLabel : label) : undefined}
    >
      {copied ? copiedLabel : label}
    </Button>
  );
}
