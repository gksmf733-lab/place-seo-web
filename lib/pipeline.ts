import { promises as fs } from "node:fs";
import path from "node:path";

import { scrapePlace } from "@/lib/scraper";
import { loadSections } from "@/lib/sections";
import { renderWorksheet } from "@/lib/worksheet";
import { updateJob, type SavedJob } from "@/lib/jobs";

/**
 * 접수된 Job 하나를 스크래핑 → 섹션 로드 → 작업지 렌더 → 파일 저장 → Job 상태 업데이트.
 * 에러가 발생해도 throw 하지 않고 Job에 기록한 뒤 반환한다 (호출부의 fire-and-forget 패턴).
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

    const scrapesDir = path.join(process.cwd(), "data", "scrapes");
    const worksheetsDir = path.join(process.cwd(), "data", "worksheets");
    await fs.mkdir(scrapesDir, { recursive: true });
    await fs.mkdir(worksheetsDir, { recursive: true });

    const scrapePath = path.join(scrapesDir, `${scraped.placeId}.json`);
    const worksheetPath = path.join(
      worksheetsDir,
      `${scraped.placeId}.md`,
    );
    await fs.writeFile(
      scrapePath,
      JSON.stringify(scraped, null, 2),
      "utf8",
    );
    await fs.writeFile(worksheetPath, markdown, "utf8");

    await updateJob(job.id, {
      scrapeStatus: "done",
      placeId: scraped.placeId,
      scrapePath: path.relative(process.cwd(), scrapePath),
      worksheetPath: path.relative(process.cwd(), worksheetPath),
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
