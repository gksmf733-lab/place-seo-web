import { scrapePlace } from "@/lib/scraper";

// Playwright는 Node.js 런타임 + 긴 실행시간이 필요함
export const runtime = "nodejs";
export const maxDuration = 120;

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "잘못된 요청 형식입니다." },
      { status: 400 },
    );
  }

  if (typeof body !== "object" || body === null) {
    return Response.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }

  const { url } = body as Record<string, unknown>;
  if (!isNonEmptyString(url)) {
    return Response.json(
      { error: "url을 입력해 주세요." },
      { status: 400 },
    );
  }
  if (!/naver\./i.test(url)) {
    return Response.json(
      { error: "네이버 플레이스 URL만 지원됩니다." },
      { status: 400 },
    );
  }

  try {
    const scraped = await scrapePlace(url.trim());
    return Response.json({ ok: true, data: scraped });
  } catch (err) {
    console.error("[/api/scrape] failed", err);
    const message = err instanceof Error ? err.message : "스크래핑 실패";
    return Response.json({ error: message }, { status: 500 });
  }
}
