import {
  PRICE_PATTERN,
  NOISE_LINES,
  MENU_BADGES,
  MENU_NAME_EXCLUDE,
  MENU_NAME_HARD_CAP,
} from "./constants";

export function extractMenuItems(lines: readonly string[]): string[] {
  const items: string[] = [];
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
      if (NOISE_LINES.has(cand) || MENU_BADGES.has(cand)) continue;
      if (MENU_NAME_EXCLUDE.some((kw) => cand.includes(kw))) continue;
      if (cand.length < 2) continue;
      candidates.push(cand);
    }

    if (candidates.length === 0) continue;

    // 가장 짧은 후보 = 이름 (설명은 항상 더 김)
    let name = candidates[0];
    for (const c of candidates) {
      if (c.length < name.length) name = c;
    }

    if (name.length > MENU_NAME_HARD_CAP) continue;
    if (seenNames.has(name)) continue;
    seenNames.add(name);
    items.push(`${name} · ${line}`);
    if (items.length >= 60) break;
  }

  return items;
}
