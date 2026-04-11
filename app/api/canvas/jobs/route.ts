import {
  listJobsForCanvasPull,
  markJobsCanvasPulled,
} from "@/lib/jobs";
import type { ScrapedPlace } from "@/lib/scraper/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * AI Canvas 커스텀 API 노드(단일 요청, GET) 전용 엔드포인트.
 * 스크래핑이 완료됐고 아직 Canvas로 넘어가지 않은 job들을
 * 평탄한 JSON 배열로 반환한다. 응답과 동시에 canvas_pulled_at 을
 * 현재 시각으로 마킹해서 다음 호출에는 같은 job이 다시 나오지 않게 한다.
 *
 * 응답 예:
 * [
 *   { "jobId":"...", "placeId":"123", "placeName":"...", ... },
 *   ...
 * ]
 *
 * 빈 배열이 정상 응답이다(처리할 신규 업체가 없는 경우).
 *
 * ?peek=1 쿼리 파라미터를 붙이면 마킹 없이 조회만 한다(디버깅용).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const peek = url.searchParams.get("peek") === "1";

  const jobs = await listJobsForCanvasPull();

  const payload = jobs.map((job) => {
    const scraped = (job.scrapedData as ScrapedPlace | null) ?? null;
    return {
      jobId: job.id,
      placeId: job.placeId ?? scraped?.placeId ?? "",
      placeName: job.placeName,
      url: job.url,
      scrapedUrl: scraped?.scrapedUrl ?? "",
      contact: job.contact,
      memo: job.memo ?? "",
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
    };
  });

  if (!peek && jobs.length > 0) {
    await markJobsCanvasPulled(jobs.map((j) => j.id));
  }

  return Response.json(payload);
}
