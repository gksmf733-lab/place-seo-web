import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl space-y-10 text-center">
        <div className="space-y-4">
          <p className="text-sm font-medium text-muted-foreground">
            네이버 플레이스 점주를 위한
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            플레이스 SEO 최적화
          </h1>
          <p className="text-base text-muted-foreground sm:text-lg">
            플레이스 URL 하나만 알려주시면,
            <br />
            전문 팀이 직접 분석하고 검색 노출에 최적화된 콘텐츠를 만들어
            드립니다.
          </p>
        </div>

        <div className="flex flex-col items-center gap-3">
          <Button
            render={<Link href="/order" />}
            size="lg"
            className="h-14 w-full max-w-xs text-base"
          >
            지금 신청하기
          </Button>
          <p className="text-xs text-muted-foreground">
            건당 300,000원 · 24시간 내 연락드립니다
          </p>
        </div>
      </div>
    </main>
  );
}
