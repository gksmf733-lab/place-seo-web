import { scrapePlace } from "@/lib/scraper";
import { loadSections } from "@/lib/sections";
import { renderWorksheet } from "@/lib/worksheet";
import { updateJob, type SavedJob } from "@/lib/jobs";

/**
 * 접수된 Job 하나를 스크래핑 → 섹션 로드 → 작업지 렌더 → Supabase DB 업데이트.
 */
export async function processJob(job: SavedJob): Promise<void> {
  const startedAt = new Date().toISOString();
  await updateJob(job.id, {
    scrapeStatus: "processing",
    scrapeStartedAt: startedAt,
  });

  try {
    const scraped = await scrapePlace(job.url);
    const sections = await loadSections();
    const markdown = renderWorksheet(scraped, sections);

    // 파일 저장을 제거하고 모든 결과를 Supabase DB에 저장합니다.
    await updateJob(job.id, {
      scrapeStatus: "done",
      placeId: scraped.placeId,
      scrapedData: scraped,
      worksheetMarkdown: markdown,
      scrapeFinishedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[pipeline] job ${job.id} failed:`, err);
    await updateJob(job.id, {
      scrapeStatus: "failed",
      scrapeError: message,
      scrapeFinishedAt: new Date().toISOString(),
    });
  }
}
