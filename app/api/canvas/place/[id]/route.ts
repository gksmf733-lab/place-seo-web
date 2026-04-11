import { readJob } from "@/lib/jobs";
import type { ScrapedPlace } from "@/lib/scraper/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * IA CANVAS 커스텀 API 노드 전용 엔드포인트.
 * 접수된 job의 Place ID와 평탄화된 업체 정보를 JSON으로 반환한다.
 * 응답은 IA CANVAS의 JSON→CSV 자동 변환이 바로 표로 만들 수 있도록
 * 스칼라 필드 위주로 구성되어 있다.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const job = await readJob(id);
  if (!job) {
    return Response.json(
      { error: "job을 찾을 수 없습니다.", id },
      { status: 404 },
    );
  }

  const scraped = (job.scrapedData as ScrapedPlace | null) ?? null;

  return Response.json({
    jobId: job.id,
    placeId: job.placeId ?? scraped?.placeId ?? "",
    placeName: job.placeName,
    url: job.url,
    scrapedUrl: scraped?.scrapedUrl ?? "",
    contact: job.contact,
    memo: job.memo ?? "",
    scrapeStatus: job.scrapeStatus,
    createdAt: job.createdAt,
    scrapeFinishedAt: job.scrapeFinishedAt ?? "",
    name: scraped?.name ?? "",
    category: scraped?.category ?? "",
    address: scraped?.address ?? "",
    phone: scraped?.phone ?? "",
    hours: scraped?.hours ?? "",
    homepage: scraped?.homepage ?? "",
    amenities: scraped?.amenities ?? "",
    rating: scraped?.rating ?? "",
    visitorReviews: scraped?.visitorReviews ?? "",
    blogReviews: scraped?.blogReviews ?? "",
    description: scraped?.description ?? "",
  });
}
