import { promises as fs } from "node:fs";
import path from "node:path";

import { scrapePlace } from "../../lib/scraper";
import { loadSections } from "../../lib/sections";
import { renderWorksheet } from "../../lib/worksheet";

async function main(): Promise<void> {
  const url = process.argv[2];
  if (!url) {
    console.error("사용법: npm run scrape <네이버 플레이스 URL>");
    process.exit(1);
  }

  console.log(`[1/3] 스크래핑 시작: ${url}`);
  const scraped = await scrapePlace(url);

  const extractedKeys: (keyof typeof scraped)[] = [
    "name",
    "category",
    "address",
    "phone",
    "hours",
    "homepage",
    "amenities",
    "rating",
    "description",
  ];
  const extractedCount = extractedKeys.filter((k) => scraped[k]).length;
  console.log(
    `      추출 필드 ${extractedCount}/${extractedKeys.length}, 메뉴 ${scraped.menuItems.length}개`,
  );
  if (scraped.name) console.log(`      업체명: ${scraped.name}`);
  if (scraped.errors.length > 0) {
    console.log(`      경고: ${scraped.errors.length}건`);
    for (const e of scraped.errors) console.log(`        - ${e}`);
  }

  console.log("[2/3] 섹션 템플릿 로드 중...");
  const sections = await loadSections();
  console.log(`      ${sections.length}개 섹션 발견`);

  console.log("[3/3] 작업지 생성 중...");
  const markdown = renderWorksheet(scraped, sections);

  const scrapesDir = path.join(process.cwd(), "data", "scrapes");
  const worksheetsDir = path.join(process.cwd(), "data", "worksheets");
  await fs.mkdir(scrapesDir, { recursive: true });
  await fs.mkdir(worksheetsDir, { recursive: true });

  const jsonPath = path.join(scrapesDir, `${scraped.placeId}.json`);
  const mdPath = path.join(worksheetsDir, `${scraped.placeId}.md`);
  await fs.writeFile(jsonPath, JSON.stringify(scraped, null, 2), "utf8");
  await fs.writeFile(mdPath, markdown, "utf8");

  console.log();
  console.log(`완료.`);
  console.log(`  JSON: ${jsonPath}`);
  console.log(`  작업지: ${mdPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
