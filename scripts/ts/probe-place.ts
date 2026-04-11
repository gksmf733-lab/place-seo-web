/**
 * 네이버 플레이스 페이지 정찰 스크립트.
 *
 * 목적: 부가서비스(예약/톡톡/스마트콜/네이버페이/주문/혜택/사진영상리뷰) 감지
 * 규칙을 확정하기 위해 실제 모바일 플레이스 페이지의 본문 텍스트와 링크
 * 구조를 덤프해서 확인용으로 출력한다.
 *
 * 사용법:
 *   npx tsx scripts/ts/probe-place.ts <placeId 또는 네이버 URL>
 *   예) npx tsx scripts/ts/probe-place.ts 1813683490
 *       npx tsx scripts/ts/probe-place.ts https://map.naver.com/p/entry/place/1813683490
 *
 * 출력:
 *   data/probe/<placeId>.txt  — 사람이 읽기 좋은 리포트
 *   data/probe/<placeId>.json — 원시 데이터
 */

import { promises as fs } from "node:fs";
import path from "node:path";

import { chromium } from "playwright";

import { extractPlaceId } from "../../lib/scraper";

const FEATURE_KEYWORDS = [
  "예약",
  "톡톡",
  "문의",
  "주문",
  "배달",
  "포장",
  "혜택",
  "쿠폰",
  "네이버페이",
  "N Pay",
  "스마트콜",
  "사진",
  "영상",
  "동영상",
];

function normalizeArg(arg: string): string {
  if (/^\d+$/.test(arg)) return arg; // placeId 직접 입력
  return extractPlaceId(arg);
}

async function main(): Promise<void> {
  const raw = process.argv[2];
  if (!raw) {
    console.error(
      "사용법: npx tsx scripts/ts/probe-place.ts <placeId 또는 네이버 URL>",
    );
    process.exit(1);
  }

  const placeId = normalizeArg(raw);
  const homeUrl = `https://m.place.naver.com/place/${placeId}/home`;
  console.log(`[probe] placeId=${placeId}`);
  console.log(`[probe] home=${homeUrl}`);

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) " +
        "AppleWebKit/605.1.15 (KHTML, like Gecko) " +
        "Version/16.0 Mobile/15E148 Safari/604.1",
      viewport: { width: 390, height: 844 },
      locale: "ko-KR",
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();

    console.log("[probe] goto home...");
    await page.goto(homeUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForTimeout(3000);

    // 페이지 전체 텍스트
    const bodyText = await page.locator("body").innerText({ timeout: 8000 });

    // 모든 <a href>
    const anchors = await page.$$eval("a[href]", (els) =>
      els.map((el) => ({
        text: (el.textContent || "").trim().slice(0, 60),
        href: (el as HTMLAnchorElement).href,
      })),
    );

    // 탭/버튼류 후보 (role=tab, role=button, <button>)
    const tabs = await page.$$eval(
      "[role='tab'], [role='button'], button",
      (els) =>
        els
          .map((el) => (el.textContent || "").trim())
          .filter((t) => t.length > 0 && t.length < 30),
    );

    // 본문에 나오는 feature 키워드 매칭
    const lines = bodyText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const keywordHits: Record<string, string[]> = {};
    for (const kw of FEATURE_KEYWORDS) {
      const hits = lines.filter((l) => l.includes(kw)).slice(0, 5);
      if (hits.length > 0) keywordHits[kw] = hits;
    }

    // href에서 네이버 서비스 도메인 매칭
    const hrefDomainHits: Record<string, string[]> = {};
    const DOMAIN_KEYS = [
      "booking.naver.com",
      "talk.naver.com",
      "order.pay.naver.com",
      "pay.naver.com",
      "nid.naver.com",
      "/booking",
      "/order",
      "/talk",
      "/benefit",
      "/coupon",
    ];
    for (const key of DOMAIN_KEYS) {
      const hits = anchors
        .filter((a) => a.href.includes(key))
        .slice(0, 5)
        .map((a) => `${a.text} → ${a.href}`);
      if (hits.length > 0) hrefDomainHits[key] = hits;
    }

    // 리포트 텍스트 구성
    const report: string[] = [];
    report.push(`# Probe Report: placeId=${placeId}`);
    report.push(`# URL: ${homeUrl}`);
    report.push(`# Generated: ${new Date().toISOString()}`);
    report.push("");
    report.push("=== BODY LINES (first 200) ===");
    report.push(...lines.slice(0, 200).map((l, i) => `${i + 1}: ${l}`));
    report.push("");
    report.push("=== KEYWORD HITS (본문) ===");
    for (const [kw, hits] of Object.entries(keywordHits)) {
      report.push(`[${kw}] ${hits.length} hit(s)`);
      hits.forEach((h) => report.push(`  - ${h}`));
    }
    if (Object.keys(keywordHits).length === 0) {
      report.push("(no hits)");
    }
    report.push("");
    report.push("=== HREF DOMAIN HITS ===");
    for (const [k, hits] of Object.entries(hrefDomainHits)) {
      report.push(`[${k}] ${hits.length} hit(s)`);
      hits.forEach((h) => report.push(`  - ${h}`));
    }
    if (Object.keys(hrefDomainHits).length === 0) {
      report.push("(no hits)");
    }
    report.push("");
    report.push(`=== ALL ANCHORS (${anchors.length}) ===`);
    anchors.slice(0, 80).forEach((a, i) => {
      report.push(`${i + 1}. "${a.text}" → ${a.href}`);
    });
    if (anchors.length > 80) {
      report.push(`... (${anchors.length - 80} more)`);
    }
    report.push("");
    report.push(`=== TAB/BUTTON CANDIDATES (${tabs.length}, unique top 40) ===`);
    const uniqTabs = Array.from(new Set(tabs)).slice(0, 40);
    uniqTabs.forEach((t, i) => report.push(`${i + 1}. ${t}`));

    // 저장
    const outDir = path.join(process.cwd(), "data", "probe");
    await fs.mkdir(outDir, { recursive: true });
    const txtPath = path.join(outDir, `${placeId}.txt`);
    const jsonPath = path.join(outDir, `${placeId}.json`);

    await fs.writeFile(txtPath, report.join("\n"), "utf8");
    await fs.writeFile(
      jsonPath,
      JSON.stringify(
        {
          placeId,
          homeUrl,
          generatedAt: new Date().toISOString(),
          bodyLines: lines,
          keywordHits,
          hrefDomainHits,
          anchors,
          tabs: uniqTabs,
        },
        null,
        2,
      ),
      "utf8",
    );

    console.log();
    console.log(`[probe] 완료.`);
    console.log(`  리포트: ${txtPath}`);
    console.log(`  원시데이터: ${jsonPath}`);
    console.log();
    console.log(`다음 단계: 리포트 파일 내용을 채팅창에 붙여넣어 주세요.`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
