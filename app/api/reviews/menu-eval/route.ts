import { readJob, updateJob } from "@/lib/jobs";
import { evaluateMenus } from "@/lib/menu-evaluation";

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
      return Response.json({ error: "리뷰가 없습니다." }, { status: 400 });
    }

    const scraped = job.scrapedData as { menuItems?: string[]; menuItemsV2?: { name: string }[] } | null;
    const menuNames: string[] = [];
    if (scraped?.menuItemsV2 && scraped.menuItemsV2.length > 0) {
      menuNames.push(...scraped.menuItemsV2.map((m) => m.name));
    } else if (scraped?.menuItems && scraped.menuItems.length > 0) {
      menuNames.push(
        ...scraped.menuItems.map((m) => m.replace(/\s*·\s*[\d,]+원$/, "").replace(/\s*·\s*변동$/, "").trim()),
      );
    }

    if (menuNames.length === 0) {
      return Response.json({ error: "메뉴 데이터가 없습니다." }, { status: 400 });
    }

    const evaluation = await evaluateMenus({
      placeName: job.placeName,
      menuNames,
      reviews,
      analysis: job.reviewAnalysis,
    });

    await updateJob(jobId, { menuEvaluation: evaluation });

    return Response.json({ ok: true, jobId, evaluation });
  } catch (err) {
    console.error("[api/reviews/menu-eval] error:", err);
    return Response.json(
      {
        error: "메뉴 평가 생성 중 오류 발생",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
