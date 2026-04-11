import { readJob, updateJob } from "@/lib/jobs";
import { readPrompt, resolvePrompt } from "@/lib/prompts";
import { generateReviewIntro } from "@/lib/review-intro";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 300;

function toArray(v: unknown): unknown[] {
  if (v == null) return [];
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed;
      return [parsed];
    } catch {
      return [v];
    }
  }
  return [v];
}

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const jobId = url.searchParams.get("jobId");
    const promptId = url.searchParams.get("promptId") ?? undefined;
    if (!jobId) {
      return Response.json(
        { error: "jobId 쿼리 파라미터가 필요합니다." },
        { status: 400 },
      );
    }

    const job = await readJob(jobId);
    if (!job) {
      return Response.json({ error: "job을 찾을 수 없습니다." }, { status: 404 });
    }

    if (!job.reviewAnalysis) {
      return Response.json(
        { error: "먼저 리뷰 AI 분석을 실행해 주세요." },
        { status: 400 },
      );
    }

    const reviews = toArray(job.reviewsData);
    if (reviews.length === 0) {
      return Response.json(
        { error: "소스 리뷰가 없습니다." },
        { status: 400 },
      );
    }

    // 프롬프트 선택: promptId가 있으면 우선, 없으면 review_intro 섹션의 기본값
    const prompt = promptId
      ? await readPrompt(promptId)
      : await resolvePrompt("review_intro");

    if (!prompt) {
      return Response.json(
        {
          error:
            "review_intro 섹션 프롬프트가 없습니다. /admin/prompts에서 먼저 등록해 주세요.",
        },
        { status: 400 },
      );
    }
    if (prompt.sectionType !== "review_intro") {
      return Response.json(
        { error: "선택한 프롬프트가 review_intro 섹션이 아닙니다." },
        { status: 400 },
      );
    }

    const scraped = (job.scrapedData ?? null) as {
      category?: string;
    } | null;

    // 이 섹션의 "프롬프트"는 가이드/스타일 지침만 담기면 됨.
    // 리뷰 분석 컨텍스트는 lib/review-intro.ts 내부에서 자동 주입된다.
    const guide = prompt.guide?.trim() || prompt.promptTemplate?.trim() || "";

    const intro = await generateReviewIntro({
      guide,
      promptId: prompt.id,
      promptName: prompt.name,
      placeName: job.placeName,
      category: scraped?.category ?? "",
      analysis: job.reviewAnalysis,
      reviews,
    });

    await updateJob(jobId, { reviewIntro: intro });

    return Response.json({ ok: true, jobId, intro });
  } catch (err) {
    console.error("[api/reviews/intro] error:", err);
    return Response.json(
      {
        error: "업체 소개글 생성 중 오류 발생",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
