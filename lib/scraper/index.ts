import type { Browser, Page } from "playwright-core";

import { PLACE_ID_PATTERN } from "./constants";
import {
  nonEmptyLines,
  cleanRawText,
  extractAddress,
  extractPhone,
  extractHours,
  extractHomepage,
  extractAmenities,
  extractRating,
  extractNameCategory,
  extractAiBrief,
} from "./extract";
import { extractMenuItems, extractMenuItemsV2 } from "./menu";
import type { ScrapedPlace } from "./types";

/**
 * BROWSERBASE_API_KEY 가 있으면 Browserbase 원격 브라우저에 CDP 로 접속한다.
 * 그 외(로컬 개발)에서는 로컬에 설치된 playwright 번들 Chromium 사용.
 *
 * Vercel 서버리스 함수 내부에서 chromium 바이너리를 직접 실행하면
 * 동시 실행 시 /tmp/chromium 에서 ETXTBSY 가 발생하므로, 프로덕션에서는
 * 브라우저를 함수 밖(Browserbase)에서 띄우도록 구성한다.
 */
export async function launchBrowser(): Promise<Browser> {
  if (process.env.BROWSERBASE_API_KEY) {
    const projectId = process.env.BROWSERBASE_PROJECT_ID;
    if (!projectId) {
      throw new Error(
        "BROWSERBASE_PROJECT_ID 환경변수가 설정되지 않았습니다.",
      );
    }

    const [{ chromium }, { default: Browserbase }] = await Promise.all([
      import("playwright-core"),
      import("@browserbasehq/sdk"),
    ]);

    const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });
    const session = await bb.sessions.create({ projectId });
    const browser = await chromium.connectOverCDP(session.connectUrl);

    // browser.close() 는 CDP 연결만 끊을 뿐 Browserbase 세션 자체는
    // 타임아웃까지 남는다. 분당 과금이라 좀비 세션이 비용이 되므로
    // 연결 종료 시 세션을 강제로 release 한다.
    browser.on("disconnected", () => {
      bb.sessions
        .update(session.id, { projectId, status: "REQUEST_RELEASE" })
        .catch(() => {
          /* 이미 만료/종료된 세션이면 무시 */
        });
    });
    return browser;
  }

  // 로컬 개발: playwright(일반) 패키지가 devDependencies로 있어야 함
  const { chromium } = await import("playwright");
  return chromium.launch({ headless: true });
}

export function extractPlaceId(url: string): string {
  const m = url.match(PLACE_ID_PATTERN);
  if (!m) {
    throw new Error(`URL에서 place ID를 찾지 못했습니다: ${url}`);
  }
  return m[1];
}

function extractFields(rawBody: string): Omit<
  ScrapedPlace,
  "placeId" | "inputUrl" | "scrapedUrl" | "rawText" | "errors"
> {
  const lines = nonEmptyLines(rawBody);
  const { name, category } = extractNameCategory(lines);
  const { rating, visitorReviews, blogReviews } = extractRating(lines);

  return {
    name,
    category,
    address: extractAddress(lines),
    phone: extractPhone(lines),
    hours: extractHours(lines),
    homepage: extractHomepage(lines),
    amenities: extractAmenities(lines),
    rating,
    visitorReviews,
    blogReviews,
    description: extractAiBrief(lines),
    menuItems: extractMenuItems(lines),
  };
}

async function loadAllMenuItems(page: Page, maxRounds = 20): Promise<void> {
  for (let round = 0; round < maxRounds; round++) {
    let prevHeight: number;
    try {
      prevHeight = await page.evaluate(() => document.body.scrollHeight);
    } catch {
      break;
    }

    try {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    } catch {
      /* ignore */
    }
    await page.waitForTimeout(700);

    try {
      const more = page.getByText("더보기", { exact: true });
      const count = await more.count();
      if (count > 0) {
        const target = more.last();
        try {
          if (await target.isVisible({ timeout: 800 })) {
            await target.click({ timeout: 2000 });
            await page.waitForTimeout(900);
          }
        } catch {
          /* ignore click errors */
        }
      }
    } catch {
      /* ignore locator errors */
    }

    let currHeight: number;
    try {
      currHeight = await page.evaluate(() => document.body.scrollHeight);
    } catch {
      break;
    }
    if (currHeight === prevHeight) break;
  }
}

export async function scrapePlace(inputUrl: string): Promise<ScrapedPlace> {
  const placeId = extractPlaceId(inputUrl);
  const homeUrl = `https://m.place.naver.com/place/${placeId}/home`;
  const menuUrl = `https://m.place.naver.com/place/${placeId}/menu/list`;

  const data: ScrapedPlace = {
    placeId,
    inputUrl,
    scrapedUrl: homeUrl,
    name: "",
    category: "",
    address: "",
    phone: "",
    hours: "",
    homepage: "",
    amenities: "",
    rating: "",
    visitorReviews: "",
    blogReviews: "",
    description: "",
    menuItems: [],
    rawText: "",
    errors: [],
  };

  const browser = await launchBrowser();
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

    // Step 1: 홈 페이지
    try {
      await page.goto(homeUrl, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      await page.waitForTimeout(2500);
    } catch (exc) {
      data.errors.push(`홈 페이지 이동 실패: ${errorMessage(exc)}`);
      return data;
    }

    let rawBody: string;
    try {
      rawBody = await page.locator("body").innerText({ timeout: 5000 });
    } catch (exc) {
      data.errors.push(`홈 본문 추출 실패: ${errorMessage(exc)}`);
      return data;
    }

    const extracted = extractFields(rawBody);
    Object.assign(data, extracted);
    data.rawText = cleanRawText(rawBody);

    // Step 2: 메뉴 전용 페이지 (best-effort)
    try {
      await page.goto(menuUrl, {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
      await page.waitForTimeout(1500);
      await loadAllMenuItems(page);
      const menuBody = await page.locator("body").innerText({ timeout: 8000 });
      const menuLines = nonEmptyLines(menuBody);
      const fullMenu = extractMenuItems(menuLines);
      const fullMenuV2 = extractMenuItemsV2(menuLines);
      if (fullMenu.length > data.menuItems.length) {
        data.menuItems = fullMenu;
        data.menuItemsV2 = fullMenuV2;
      }
    } catch (exc) {
      data.errors.push(
        `메뉴 페이지 처리 실패 (홈 페이지 메뉴는 유지): ${errorMessage(exc)}`,
      );
    }
  } finally {
    await browser.close();
  }

  return data;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export type { ScrapedPlace, MenuItem } from "./types";
