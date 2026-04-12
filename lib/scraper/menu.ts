import {
  PRICE_PATTERN,
  NOISE_LINES,
  MENU_BADGES,
  MENU_NAME_EXCLUDE,
  MENU_NAME_HARD_CAP,
  PHONE_LIKE_PATTERN,
} from "./constants";
import type { MenuItem } from "./types";

function isNoiseLine(line: string): boolean {
  if (NOISE_LINES.has(line)) return true;
  if (MENU_BADGES.has(line)) return true;
  if (MENU_NAME_EXCLUDE.some((kw) => line.includes(kw))) return true;
  if (PHONE_LIKE_PATTERN.test(line)) return true;
  if (PRICE_PATTERN.test(line)) return true;
  if (line === "변동") return true;
  if (line.length < 2) return true;
  // 프로모/슬로건 텍스트 필터 (느낌표·물결표 끝나거나 콤마로 나열된 긴 문장)
  if (line.endsWith("!") || line.endsWith("~")) return true;
  if (line.includes("가능한") && line.length > 15) return true;
  if (line.includes("전화") || line.includes("상담")) return true;
  return false;
}

/**
 * 메뉴 페이지 본문에서 구조화된 메뉴 아이템을 추출한다.
 *
 * 네이버 플레이스 메뉴 페이지 패턴:
 *   [배지 (대표/인기/NEW)]   ← skip
 *   메뉴명                   ← name (가장 짧은 비-노이즈 후보)
 *   메뉴 설명 (선택)          ← description (name보다 긴 후보)
 *   N,NNN원 | 변동           ← price (트리거)
 */
export function extractMenuItemsV2(lines: readonly string[]): MenuItem[] {
  const items: MenuItem[] = [];
  const seenNames = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isPrice = PRICE_PATTERN.test(line);
    const isVariable = line === "변동";
    if (!isPrice && !isVariable) continue;
    if (i === 0) continue;

    const candidates: string[] = [];
    for (let back = 1; back <= 5; back++) {
      const idx = i - back;
      if (idx < 0) break;
      const cand = lines[idx];
      if (PRICE_PATTERN.test(cand) || cand === "변동") break;
      if (isNoiseLine(cand)) continue;
      if (cand.length > MENU_NAME_HARD_CAP * 3) continue;
      candidates.push(cand);
    }

    if (candidates.length === 0) continue;

    // 가장 짧은 후보 = 메뉴명, 나머지 중 가장 긴 것 = 설명
    let name = candidates[0];
    let desc: string | undefined;
    for (const c of candidates) {
      if (c.length < name.length) name = c;
    }

    if (name.length > MENU_NAME_HARD_CAP) continue;
    if (seenNames.has(name)) continue;
    seenNames.add(name);

    // 설명: name이 아닌 후보 중 가장 긴 것
    const descCandidates = candidates.filter((c) => c !== name);
    if (descCandidates.length > 0) {
      desc = descCandidates.reduce((a, b) => (a.length >= b.length ? a : b));
    }

    items.push({
      name,
      price: line,
      description: desc,
    });

    if (items.length >= 60) break;
  }

  return items;
}

/** 하위호환: 기존 string[] 형태도 반환 */
export function extractMenuItems(lines: readonly string[]): string[] {
  return extractMenuItemsV2(lines).map(
    (m) => `${m.name} · ${m.price}`,
  );
}
