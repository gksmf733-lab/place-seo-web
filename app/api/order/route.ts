import { saveJob, updateJob, type OrderInput } from "@/lib/jobs";
import { processJob } from "@/lib/pipeline";

// Playwright가 백그라운드 작업에서 호출되므로 Node 런타임 명시
export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_URL_LENGTH = 2048;
const MAX_FIELD_LENGTH = 500;

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function isValidNaverUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    return /naver\./i.test(parsed.hostname) && ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
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
  if (url.length > MAX_URL_LENGTH) {
    return Response.json(
      { error: `URL은 ${MAX_URL_LENGTH}자를 초과할 수 없습니다.` },
      { status: 400 },
    );
  }
  if (!isValidNaverUrl(url)) {
    return Response.json(
      { error: "유효한 네이버 플레이스 URL만 접수됩니다." },
      { status: 400 },
    );
  }
  if (!isNonEmptyString(placeName) || placeName.length > MAX_FIELD_LENGTH) {
    return Response.json(
      { error: "업체명을 입력해 주세요. (최대 500자)" },
      { status: 400 },
    );
  }
  if (!isNonEmptyString(contact) || contact.length > MAX_FIELD_LENGTH) {
    return Response.json(
      { error: "연락처를 입력해 주세요. (최대 500자)" },
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
    void processJob(job).catch(async (err) => {
      console.error(`[order] background processJob failed for ${job.id}:`, err);
      // 파이프라인 자체에서 실패 마킹을 못 한 경우를 위한 안전망
      try {
        await updateJob(job.id, {
          scrapeStatus: "failed",
          scrapeError: err instanceof Error ? err.message : String(err),
        });
      } catch {
        // 위에서 이미 로깅됨
      }
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
