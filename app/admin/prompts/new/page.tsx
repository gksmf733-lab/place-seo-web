import Link from "next/link";

import { Button } from "@/components/ui/button";
import { PromptForm } from "@/components/prompt-form";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function NewPromptPage() {
  return (
    <main className="flex flex-1 flex-col px-6 py-12">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">새 프롬프트</h1>
          <Button
            render={<Link href="/admin/prompts" />}
            variant="outline"
            size="sm"
          >
            ← 목록으로
          </Button>
        </div>
        <PromptForm mode="create" />
      </div>
    </main>
  );
}
