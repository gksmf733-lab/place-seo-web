import crypto from "node:crypto";
import { readJob, updateJob } from "@/lib/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CRAWLER_URL =
  process.env.REVIEW_CRAWLER_URL || "http://localhost:3003";

/* ── 중복 제거 헬퍼 (기존 /api/reviews/route.ts 동일 로직) ── */

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value))
    return "[" + value.map(stableStringify).join(",") + "]";
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return (
    "{" +
    keys
      .map(
        (k) =>
          JSON.stringify(k) +
          ":" +
          stableStringify((value as Record<string, unknown>)[k]),
      )
      .join(",") +
    "}"
  );
}

function contentHash(item: unknown): string {
  return crypto
    .createHash("sha1")
    .update(stableStringify(item))
    .digest("hex");
}

function toArray(v: unknown): unknown[] {
  if (v == null) return [];
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [v];
    }
  }
  return [v];
}

/* ── 크롤러 응답 → ReviewsTable 형식 매핑 ── */

type CrawlerReview = {
  account?: string;
  visitDate?: string;
  visitTime?: string;
  reservation?: string;
  waitTime?: string;
  purpose?: string;
  companions?: string;
  keywords?: string;
  visitCount?: string;
  authMethod?: string;
  viewCount?: string;
  content?: string;
};

function mapReview(r: CrawlerReview): Record<string, unknown> {
  return {
    account: r.account || "",
    visitDate: r.visitDate || "",
    visitTime: r.visitTime || "",
    reservation: r.reservation || "",
    waitTime: r.waitTime || "",
    purpose: r.purpose || "",
    companions: r.companions || "",
    keywords: r.keywords || "",
    visitCount: r.visitCount || "",
    authMethod: r.authMethod || "",
    viewCount: r.viewCount || "",
    review: r.content || "",
  };
}

/* ── GET: 크롤러 헬스체크 ── */

export async function GET() {
  try {
    const res = await fetch(`${CRAWLER_URL}/api/health`, {
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    return Response.json({ available: data.status === "ok", ...data });
  } catch {
    return Response.json({ available: false, error: "크롤러에 연결할 수 없습니다." });
  }
}

/* ── POST: 크롤링 실행 + DB 저장 ── */

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { jobId, maxReviews = 200 } = body as {
      jobId?: string;
      maxReviews?: number;
    };

    if (!jobId) {
      return Response.json({ error: "jobId가 필요합니다." }, { status: 400 });
    }

    const job = await readJob(jobId);
    if (!job) {
      return Response.json({ error: "job을 찾을 수 없습니다." }, { status: 404 });
    }
    if (!job.url) {
      return Response.json({ error: "job에 URL이 없습니다." }, { status: 400 });
    }

    // 1. 크롤러에 수집 요청
    const crawlRes = await fetch(`${CRAWLER_URL}/api/crawl`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: job.url,
        maxReviews: Math.min(Math.max(maxReviews, 10), 500),
        rotateIpBefore: true,
      }),
      signal: AbortSignal.timeout(240_000), // 4분 타임아웃
    });

    const crawlData = await crawlRes.json();
    if (!crawlData.success) {
      return Response.json(
        { error: crawlData.error || "크롤링 실패" },
        { status: 502 },
      );
    }

    // 2. 데이터 매핑
    const mapped = (crawlData.reviews as CrawlerReview[]).map(mapReview);

    // 3. 기존 리뷰에 중복 제거 후 추가
    const existing = toArray(job.reviewsData);
    const seen = new Set<string>();
    const merged: unknown[] = [];

    for (const item of existing) {
      const h = contentHash(item);
      if (!seen.has(h)) {
        seen.add(h);
        merged.push(item);
      }
    }

    let added = 0;
    for (const item of mapped) {
      const h = contentHash(item);
      if (!seen.has(h)) {
        seen.add(h);
        merged.push(item);
        added++;
      }
    }

    await updateJob(jobId, { reviewsData: merged });

    return Response.json({
      ok: true,
      crawled: crawlData.totalCollected,
      added,
      duplicates: mapped.length - added,
      total: merged.length,
      placeName: crawlData.place?.name,
    });
  } catch (err) {
    console.error("[api/reviews/crawl POST] error:", err);
    const message =
      err instanceof Error ? err.message : "크롤링 중 오류 발생";
    return Response.json({ error: message }, { status: 500 });
  }
}
