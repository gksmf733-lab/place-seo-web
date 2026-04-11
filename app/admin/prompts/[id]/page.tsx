import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { PromptForm } from "@/components/prompt-form";
import { readPrompt } from "@/lib/prompts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditPromptPage({ params }: PageProps) {
  const { id } = await params;
  const prompt = await readPrompt(id);
  if (!prompt) notFound();

  return (
    <main className="flex flex-1 flex-col px-6 py-12">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">프롬프트 편집</h1>
          <Button
            render={<Link href="/admin/prompts" />}
            variant="outline"
            size="sm"
          >
            ← 목록으로
          </Button>
        </div>
        <PromptForm
          mode="edit"
          initial={{
            id: prompt.id,
            sectionType: prompt.sectionType,
            name: prompt.name,
            description: prompt.description,
            guide: prompt.guide,
            promptTemplate: prompt.promptTemplate,
            isDefault: prompt.isDefault,
            sortOrder: prompt.sortOrder,
          }}
        />
      </div>
    </main>
  );
}
