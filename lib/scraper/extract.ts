import {
  NOISE_LINES,
  NOISE_PATTERNS,
  TIME_PATTERN,
  KOREAN_TIME_PATTERN,
  PHONE_PATTERN,
  RATING_PATTERN,
  CLOSED_DAY_PATTERN,
  URL_PATTERN,
  RAW_EXCERPT_LIMIT,
} from "./constants";

export function nonEmptyLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function findLineIndex(lines: readonly string[], label: string): number {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === label) return i;
  }
  return -1;
}

export function cleanRawText(text: string): string {
  if (!text) return "";
  const lines = text.split("\n").map((l) => l.trim());
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const line of lines) {
    if (!line || line.length < 2) continue;
    if (NOISE_LINES.has(line)) continue;
    if (NOISE_PATTERNS.some((p) => p.test(line))) continue;
    if (seen.has(line)) continue;
    seen.add(line);
    cleaned.push(line);
  }
  return cleaned.join("\n").slice(0, RAW_EXCERPT_LIMIT);
}

export function extractAddress(lines: readonly string[]): string {
  const i = findLineIndex(lines, "주소");
  if (i < 0 || i + 1 >= lines.length) return "";
  const raw = lines[i + 1];
  return raw.replace(/(지도|내비게이션|거리뷰).*$/, "").trim();
}

export function extractPhone(lines: readonly string[]): string {
  const i = findLineIndex(lines, "전화번호");
  if (i < 0) return "";
  for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
    const m = lines[j].match(PHONE_PATTERN);
    if (m) return m[0];
  }
  return "";
}

export function extractHours(lines: readonly string[]): string {
  const i = findLineIndex(lines, "영업시간");
  if (i >= 0) {
    for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
      if (TIME_PATTERN.test(lines[j]) || KOREAN_TIME_PATTERN.test(lines[j])) {
        return lines[j];
      }
    }
  }

  let timeLine = "";
  let closedLine = "";
  const scan = lines.slice(0, 150);
  for (const line of scan) {
    if (
      !timeLine &&
      (TIME_PATTERN.test(line) || KOREAN_TIME_PATTERN.test(line))
    ) {
      if (line.includes("영업") || line.includes("영업 종료") || line.length < 40) {
        timeLine = line;
      }
    }
    if (!closedLine && CLOSED_DAY_PATTERN.test(line)) {
      closedLine = line;
    }
    if (timeLine && closedLine) break;
  }

  return [timeLine, closedLine].filter(Boolean).join(" · ");
}

export function extractHomepage(lines: readonly string[]): string {
  const i = findLineIndex(lines, "홈페이지");
  if (i >= 0 && i + 1 < lines.length) {
    const candidate = lines[i + 1];
    if (candidate.startsWith("http")) return candidate;
  }

  for (const line of lines) {
    const m = line.match(URL_PATTERN);
    if (m) {
      const url = m[0].replace(/[,.)]+$/, "");
      if (url.includes("search.naver.com") || url.includes("map.naver.com")) {
        continue;
      }
      return url;
    }
  }
  return "";
}

export function extractAmenities(lines: readonly string[]): string {
  const i = findLineIndex(lines, "편의");
  if (i < 0 || i + 1 >= lines.length) return "";
  const candidate = lines[i + 1];
  if (
    candidate.includes(",") ||
    candidate.includes("가능") ||
    candidate.includes("포장")
  ) {
    return candidate;
  }
  return "";
}

export function extractRating(
  lines: readonly string[],
): { rating: string; visitorReviews: string; blogReviews: string } {
  const scan = lines.slice(0, 50);
  for (const line of scan) {
    const m = line.match(RATING_PATTERN);
    if (m) {
      return {
        rating: m[1] ?? "",
        visitorReviews: m[2],
        blogReviews: m[3],
      };
    }
  }
  return { rating: "", visitorReviews: "", blogReviews: "" };
}

const CATEGORY_ALLOWED_CHARS = /^[\p{L},/·· ]+$/u;

export function extractNameCategory(
  lines: readonly string[],
): { name: string; category: string } {
  const scan = lines.slice(0, 15);
  for (let i = 0; i < scan.length; i++) {
    const line = scan[i];
    if (line.length > 30 || line.length < 1) continue;
    for (
      let j = i + 1;
      j < Math.min(i + 12, lines.length);
      j++
    ) {
      const candidate = lines[j];
      if (candidate === line) continue;
      if (candidate.startsWith(line) && candidate.length > line.length) {
        const category = candidate.slice(line.length).trim();
        if (category && CATEGORY_ALLOWED_CHARS.test(category)) {
          return { name: line, category };
        }
      }
    }
  }
  return { name: "", category: "" };
}

export function extractAiBrief(lines: readonly string[]): string {
  const anchor = "리뷰를 기반으로 주요 특징을 정리하면 다음과 같습니다.";
  let i = -1;
  for (let idx = 0; idx < lines.length; idx++) {
    if (lines[idx].includes(anchor)) {
      i = idx;
      break;
    }
  }
  if (i < 0) return "";

  const brief: string[] = [];
  const sectionHeaders = new Set(["내부", "외부", "음식·음료", "메뉴판"]);
  for (let j = i + 1; j < Math.min(i + 20, lines.length); j++) {
    const line = lines[j];
    if (sectionHeaders.has(line)) break;
    if (/^\d{2}\.\d{2}\.\d{2}/.test(line)) break;
    if (/^\d{4}년/.test(line)) break;
    if (/^\d+$/.test(line)) continue;
    if (line.length >= 15) brief.push(line);
    if (brief.length >= 4) break;
  }
  return brief.join(" ");
}
