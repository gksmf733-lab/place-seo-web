import type { ScrapedPlace } from "@/lib/scraper/types";
import type { Section } from "@/lib/sections";

function orMissing(v: string): string {
  return v ? v : "(추출 실패)";
}

export function formatPlaceDataBlock(data: ScrapedPlace): string {
  let ratingLine: string;
  if (data.rating && data.visitorReviews) {
    ratingLine = `${data.rating}점 (방문자 리뷰 ${data.visitorReviews}, 블로그 리뷰 ${data.blogReviews})`;
  } else if (data.visitorReviews) {
    ratingLine = `방문자 리뷰 ${data.visitorReviews}, 블로그 리뷰 ${data.blogReviews} (별점 미집계)`;
  } else {
    ratingLine = "(추출 실패)";
  }

  let menuLine = "(추출 실패)";
  if (data.menuItems.length > 0) {
    menuLine = "\n  - " + data.menuItems.join("\n  - ");
  }

  return [
    `- 업체명: ${orMissing(data.name)}`,
    `- 카테고리: ${orMissing(data.category)}`,
    `- 주소: ${orMissing(data.address)}`,
    `- 전화: ${orMissing(data.phone)}`,
    `- 영업시간: ${orMissing(data.hours)}`,
    `- 홈페이지: ${orMissing(data.homepage)}`,
    `- 편의시설: ${orMissing(data.amenities)}`,
    `- 별점/리뷰: ${ratingLine}`,
    `- AI 브리핑(리뷰 요약): ${orMissing(data.description)}`,
    `- 메뉴: ${menuLine}`,
  ].join("\n");
}

export function renderWorksheet(
  data: ScrapedPlace,
  sections: readonly Section[],
): string {
  const placeBlock = formatPlaceDataBlock(data);
  const rawExcerpt = data.rawText || "(원문 추출 실패)";

  const parts: string[] = [];
  parts.push("# 플레이스 SEO 최적화 작업지");
  parts.push("");
  parts.push(`- 원본 URL: ${data.inputUrl}`);
  parts.push(`- Place ID: ${data.placeId}`);
  parts.push(`- 스크래핑 URL: ${data.scrapedUrl}`);
  if (data.errors.length > 0) {
    parts.push("");
    parts.push("## 스크래핑 오류");
    for (const e of data.errors) parts.push(`- ${e}`);
  }
  parts.push("");
  parts.push("## 추출된 현재 정보");
  parts.push("");
  parts.push(placeBlock);
  parts.push("");
  parts.push("---");
  parts.push("");
  parts.push("# 섹션별 최적화 작업");
  parts.push("");
  parts.push(
    "각 섹션의 프롬프트 블록을 복사하여 Antigravity / Claude 채팅창에 붙여넣으세요. " +
      "받은 결과를 '결과' 영역에 기록하고, 그대로 네이버 플레이스에 붙여넣으면 됩니다.",
  );
  parts.push("");

  if (sections.length === 0) {
    parts.push(
      "> data/sections/ 폴더에 YAML 파일이 없습니다. 먼저 섹션 템플릿을 추가해주세요.",
    );
  } else {
    sections.forEach((sec, idx) => {
      const i = idx + 1;
      const name = sec.name || `섹션 ${i}`;
      const promptFilled = sec.prompt
        .replaceAll("{place_data}", placeBlock)
        .replaceAll("{raw_excerpt}", rawExcerpt);

      parts.push(`## 섹션 ${i}: ${name}`);
      parts.push("");
      if (sec.description) {
        parts.push(`> ${sec.description}`);
        parts.push("");
      }
      if (sec.guide) {
        parts.push("### 작성 가이드");
        parts.push("");
        parts.push(sec.guide.trim());
        parts.push("");
      }
      parts.push("### 프롬프트 (복사해서 사용)");
      parts.push("");
      parts.push("````");
      parts.push(promptFilled.trim());
      parts.push("````");
      parts.push("");
      parts.push("### 결과 (작업 후 이곳에 기록)");
      parts.push("");
      parts.push("_(여기에 붙여넣기)_");
      parts.push("");
      parts.push("---");
      parts.push("");
    });
  }

  return parts.join("\n");
}
