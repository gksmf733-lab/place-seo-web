"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
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
  url: string;
  placeName: string;
  contact: string;
  memo: string;
};

const EMPTY: FormState = { url: "", placeName: "", contact: "", memo: "" };

export default function OrderPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);

  const update =
    <K extends keyof FormState>(key: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    const url = form.url.trim();
    const placeName = form.placeName.trim();
    const contact = form.contact.trim();

    if (!url) return toast.error("플레이스 URL을 입력해 주세요.");
    if (!/naver\./i.test(url))
      return toast.error("네이버 플레이스 URL만 접수됩니다.");
    if (!placeName) return toast.error("업체명을 입력해 주세요.");
    if (!contact) return toast.error("연락처를 입력해 주세요.");

    setSubmitting(true);
    try {
      const res = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          placeName,
          contact,
          memo: form.memo.trim() || undefined,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        id?: string;
        error?: string;
      };

      if (!res.ok || !data.ok || !data.id) {
        throw new Error(data.error ?? "접수에 실패했습니다.");
      }

      setForm(EMPTY);
      router.push(`/order/success?id=${encodeURIComponent(data.id)}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "접수에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-16">
      <div className="w-full max-w-xl space-y-8">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            플레이스 SEO 최적화 신청
          </h1>
          <p className="text-sm text-muted-foreground">
            정보를 남겨 주시면 24시간 내로 연락드립니다.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>신청서</CardTitle>
            <CardDescription>
              플레이스 URL과 연락처만 있으면 접수됩니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="url">네이버 플레이스 URL</Label>
                <Input
                  id="url"
                  type="url"
                  inputMode="url"
                  placeholder="https://map.naver.com/..."
                  value={form.url}
                  onChange={update("url")}
                  disabled={submitting}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="placeName">업체명</Label>
                <Input
                  id="placeName"
                  placeholder="예: 한강뷰 카페"
                  value={form.placeName}
                  onChange={update("placeName")}
                  disabled={submitting}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact">연락처 (전화 또는 이메일)</Label>
                <Input
                  id="contact"
                  placeholder="010-0000-0000 또는 name@example.com"
                  value={form.contact}
                  onChange={update("contact")}
                  disabled={submitting}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="memo">요청사항 (선택)</Label>
                <Textarea
                  id="memo"
                  placeholder="특별히 강조하고 싶은 키워드나 요청이 있다면 적어 주세요."
                  rows={4}
                  value={form.memo}
                  onChange={update("memo")}
                  disabled={submitting}
                />
              </div>

              <Button
                type="submit"
                size="lg"
                className="h-12 w-full text-base"
                disabled={submitting}
              >
                {submitting ? "접수 중..." : "신청하기"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="text-center text-xs text-muted-foreground">
          <Link href="/" className="underline-offset-4 hover:underline">
            ← 홈으로
          </Link>
        </div>
      </div>
    </main>
  );
}
