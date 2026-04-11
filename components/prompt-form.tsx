"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type FormState = {
  sectionType: string;
  name: string;
  description: string;
  guide: string;
  promptTemplate: string;
  isDefault: boolean;
  sortOrder: number;
};

type Props = {
  mode: "create" | "edit";
  initial?: Partial<FormState> & { id?: string };
};

const EMPTY: FormState = {
  sectionType: "intro",
  name: "",
  description: "",
  guide: "",
  promptTemplate: "",
  isDefault: false,
  sortOrder: 0,
};

const SECTION_TYPE_OPTIONS = [
  { value: "intro", label: "intro — 업체 소개글" },
  { value: "keywords", label: "keywords — 대표 키워드 / 해시태그" },
  { value: "menu", label: "menu — 메뉴/상품 설명" },
  { value: "custom", label: "custom — 기타" },
];

export function PromptForm({ mode, initial }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({ ...EMPTY, ...initial });
  const [submitting, setSubmitting] = useState(false);

  const update =
    <K extends keyof FormState>(key: K) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => {
      const value =
        key === "sortOrder"
          ? Number(e.target.value) || 0
          : key === "isDefault"
            ? (e.target as HTMLInputElement).checked
            : e.target.value;
      setForm((prev) => ({ ...prev, [key]: value }));
    };

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    if (!form.name.trim() || !form.promptTemplate.trim()) {
      toast.error("이름과 프롬프트는 필수입니다.");
      return;
    }

    setSubmitting(true);
    try {
      const endpoint =
        mode === "create" ? "/api/prompts" : `/api/prompts/${initial?.id}`;
      const method = mode === "create" ? "POST" : "PUT";
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "저장 실패");
      }
      toast.success("저장되었습니다");
      router.push("/admin/prompts");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete() {
    if (mode !== "edit" || !initial?.id) return;
    if (!confirm("이 프롬프트를 삭제하시겠습니까?")) return;
    try {
      const res = await fetch(`/api/prompts/${initial.id}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "삭제 실패");
      toast.success("삭제되었습니다");
      router.push("/admin/prompts");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "삭제 실패");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {mode === "create" ? "새 프롬프트" : "프롬프트 편집"}
        </CardTitle>
        <CardDescription>
          <code>{"{place_data}"}</code>과 <code>{"{raw_excerpt}"}</code>는
          자동으로 치환됩니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="sectionType">섹션 타입</Label>
            <select
              id="sectionType"
              value={form.sectionType}
              onChange={update("sectionType")}
              disabled={submitting}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {SECTION_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">이름</Label>
            <Input
              id="name"
              value={form.name}
              onChange={update("name")}
              placeholder="예: 친근한 톤 소개글 v2"
              disabled={submitting}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">한 줄 설명</Label>
            <Input
              id="description"
              value={form.description}
              onChange={update("description")}
              placeholder="선택 사항"
              disabled={submitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="guide">작성 가이드 (선택)</Label>
            <Textarea
              id="guide"
              value={form.guide}
              onChange={update("guide")}
              rows={5}
              placeholder="- 항목1&#10;- 항목2"
              disabled={submitting}
              className="font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="promptTemplate">
              프롬프트 본문 *
            </Label>
            <Textarea
              id="promptTemplate"
              value={form.promptTemplate}
              onChange={update("promptTemplate")}
              rows={16}
              placeholder="너는 네이버 플레이스 SEO 전문가야...&#10;&#10;[업체 정보]&#10;{place_data}"
              disabled={submitting}
              required
              className="font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sortOrder">정렬 순서</Label>
              <Input
                id="sortOrder"
                type="number"
                value={form.sortOrder}
                onChange={update("sortOrder")}
                disabled={submitting}
              />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={update("isDefault")}
                  disabled={submitting}
                  className="h-4 w-4"
                />
                이 섹션 타입의 기본 프롬프트로 설정
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex gap-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? "저장 중..." : "저장"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/admin/prompts")}
                disabled={submitting}
              >
                취소
              </Button>
            </div>
            {mode === "edit" && (
              <Button
                type="button"
                variant="destructive"
                onClick={onDelete}
                disabled={submitting}
              >
                삭제
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
