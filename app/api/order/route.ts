import { saveJob, type OrderInput } from "@/lib/jobs";
import { processJob } from "@/lib/pipeline";

// Playwright가 백그라운드 작업에서 호출되므로 Node 런타임 명시
export const runtime = "nodejs";
export const maxDuration = 300;

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

  const { url, placeName, contact, memo } = body as Record<string, unknown>;

  if (!isNonEmptyString(url)) {
    return Response.json(
      { error: "플레이스 URL을 입력해 주세요." },
      { status: 400 },
    );
  }
  if (!/naver\./i.test(url)) {
    return Response.json(
      { error: "네이버 플레이스 URL만 접수됩니다." },
      { status: 400 },
    );
  }
  if (!isNonEmptyString(placeName)) {
    return Response.json(
      { error: "업체명을 입력해 주세요." },
      { status: 400 },
    );
  }
  if (!isNonEmptyString(contact)) {
    return Response.json(
      { error: "연락처를 입력해 주세요." },
      { status: 400 },
    );
  }

  const input: OrderInput = {
    url: url.trim(),
    placeName: placeName.trim(),
    contact: contact.trim(),
    memo: isNonEmptyString(memo) ? memo.trim() : undefined,
  };

  try {
    const job = await saveJob(input);
    // 백그라운드로 스크래핑 + 작업지 생성 (fire-and-forget)
    void processJob(job).catch((err) => {
      console.error(`[order] background processJob failed for ${job.id}:`, err);
    });
    return Response.json({ ok: true, id: job.id });
  } catch (err) {
    console.error("[order] saveJob failed", err);
    return Response.json(
      { error: "접수 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 500 },
    );
  }
}
