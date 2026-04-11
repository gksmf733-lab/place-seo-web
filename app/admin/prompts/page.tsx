import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { listPrompts } from "@/lib/prompts";
import { SeedButton } from "@/components/seed-button";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SECTION_LABEL: Record<string, string> = {
  intro: "업체 소개글",
  keywords: "대표 키워드 / 해시태그",
  menu: "메뉴/상품 설명",
  custom: "기타",
};

export default async function AdminPromptsPage() {
  const prompts = await listPrompts();

  const bySection = new Map<string, typeof prompts>();
  for (const p of prompts) {
    const arr = bySection.get(p.sectionType) ?? [];
    arr.push(p);
    bySection.set(p.sectionType, arr);
  }
  const sectionOrder = ["intro", "keywords", "menu"];
  const sortedSections = [
    ...sectionOrder.filter((s) => bySection.has(s)),
    ...Array.from(bySection.keys()).filter((s) => !sectionOrder.includes(s)),
  ];

  return (
    <main className="flex flex-1 flex-col px-6 py-12">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">프롬프트 라이브러리</h1>
            <p className="text-sm text-muted-foreground">
              섹션 타입별로 프롬프트 변형을 관리합니다. 총 {prompts.length}개
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              render={<Link href="/admin/jobs" />}
              variant="outline"
              size="sm"
            >
              ← 접수 목록
            </Button>
            <Button
              render={<Link href="/admin/prompts/new" />}
              size="sm"
            >
              + 새 프롬프트
            </Button>
          </div>
        </div>

        {prompts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-12 text-center text-sm text-muted-foreground">
              <p>
                프롬프트가 하나도 없습니다. 기존 YAML 템플릿으로 초기 데이터를
                채우거나, 새로 만들 수 있습니다.
              </p>
              <div className="flex gap-2">
                <SeedButton />
                <Button
                  render={<Link href="/admin/prompts/new" />}
                  size="sm"
                >
                  + 직접 만들기
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          sortedSections.map((sectionType) => {
            const items = bySection.get(sectionType) ?? [];
            return (
              <div key={sectionType} className="space-y-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">
                    {SECTION_LABEL[sectionType] ?? sectionType}
                  </h2>
                  <Badge variant="outline">{sectionType}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {items.length}개
                  </span>
                </div>
                <div className="grid gap-3">
                  {items.map((p) => (
                    <Card key={p.id}>
                      <CardHeader className="flex flex-row items-start justify-between gap-4">
                        <div className="space-y-1">
                          <CardTitle className="text-base">
                            <Link
                              href={`/admin/prompts/${p.id}`}
                              className="hover:underline underline-offset-4"
                            >
                              {p.name}
                            </Link>
                          </CardTitle>
                          {p.description && (
                            <CardDescription>{p.description}</CardDescription>
                          )}
                        </div>
                        {p.isDefault && (
                          <Badge variant="default">기본</Badge>
                        )}
                      </CardHeader>
                      <CardContent>
                        <pre className="max-h-32 overflow-hidden rounded-md border bg-muted/40 px-3 py-2 text-[0.7rem] whitespace-pre-wrap break-words text-muted-foreground">
                          {p.promptTemplate.slice(0, 300)}
                          {p.promptTemplate.length > 300 ? "…" : ""}
                        </pre>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}
