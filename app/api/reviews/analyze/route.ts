import { readJob, updateJob } from "@/lib/jobs";
import { analyzeReviews } from "@/lib/review-analysis";

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

    const job = await readJob(jobId);
    if (!job) {
      return Response.json({ error: "job을 찾을 수 없습니다." }, { status: 404 });
    }

    const reviews = toArray(job.reviewsData);
    if (reviews.length === 0) {
      return Response.json(
        { error: "분석할 리뷰가 없습니다." },
        { status: 400 },
      );
    }

    const scraped = (job.scrapedData ?? null) as {
      category?: string;
    } | null;

    const analysis = await analyzeReviews({
      placeName: job.placeName,
      category: scraped?.category,
      reviews,
    });

    await updateJob(jobId, { reviewAnalysis: analysis });

    return Response.json({ ok: true, jobId, analysis });
  } catch (err) {
    console.error("[api/reviews/analyze] error:", err);
    return Response.json(
      {
        error: "리뷰 분석 중 오류 발생",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
