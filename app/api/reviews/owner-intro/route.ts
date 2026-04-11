import { readJob, updateJob } from "@/lib/jobs";
import { generateOwnerIntro } from "@/lib/owner-intro";

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
    if (!jobId) {
      return Response.json(
        { error: "jobId 쿼리 파라미터가 필요합니다." },
        { status: 400 },
      );
    }

    let guide: string | undefined;
    try {
      const body = (await req.json()) as { guide?: string } | null;
      if (body && typeof body.guide === "string") {
        guide = body.guide;
      }
    } catch {
      // 바디 없음 — 허용
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

    const scraped = (job.scrapedData ?? null) as { category?: string } | null;

    const intro = await generateOwnerIntro({
      placeName: job.placeName,
      category: scraped?.category ?? "",
      analysis: job.reviewAnalysis,
      reviews,
      guide,
    });

    await updateJob(jobId, { ownerIntro: intro });

    return Response.json({ ok: true, jobId, intro });
  } catch (err) {
    console.error("[api/reviews/owner-intro] error:", err);
    return Response.json(
      {
        error: "사장님 소개글 생성 중 오류 발생",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
