import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type SuccessPageProps = {
  searchParams: Promise<{ id?: string }>;
};

export default async function OrderSuccessPage({
  searchParams,
}: SuccessPageProps) {
  const { id } = await searchParams;

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-16">
      <div className="w-full max-w-xl space-y-8">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            접수가 완료되었습니다
          </h1>
          <p className="text-sm text-muted-foreground">
            전문 팀이 내용을 확인한 뒤 24시간 내에 연락드리겠습니다.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>접수 정보</CardTitle>
            <CardDescription>
              문의 시 아래 접수번호를 알려 주시면 빠르게 확인해 드릴 수 있습니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                접수번호
              </p>
              <p className="rounded-md border bg-muted/40 px-3 py-2 font-mono text-sm break-all">
                {id ?? "알 수 없음"}
              </p>
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>• 영업일 기준 24시간 내 연락드립니다.</p>
              <p>• 연락처로 남겨 주신 번호/이메일로 먼저 회신드립니다.</p>
              <p>• 건당 300,000원 · 결제는 상담 후 진행됩니다.</p>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col items-center gap-3">
          <Button
            render={<Link href="/" />}
            size="lg"
            className="h-12 w-full max-w-xs text-base"
          >
            홈으로 돌아가기
          </Button>
        </div>
      </div>
    </main>
  );
}
