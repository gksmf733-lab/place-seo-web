import type { Page } from "playwright-core";

import { launchBrowser, extractPlaceId } from "./scraper";

export type ProbeAnchor = { text: string; href: string };

export type FeedInfo = {
  count: number;
  latestDate: string | null;
  feedUrl: string;
};

export type CouponInfo = {
  title: string;
  content: string;
};

export type BookingInfo = {
  items: string[];
  url: string;
};

export type SmartcallInfo = {
  primary: string | null;
  secondary: string | null;
  allTels: string[];
};

export type FeatureKey =
  | "booking"
  | "talk"
  | "smartcall"
  | "naverpay"
  | "order"
  | "coupon"
  | "news"
  | "photoReview";

export type FeatureCheck = {
  key: FeatureKey;
  label: string;
  active: boolean;
  evidence: string[];
};

export type ProbeResult = {
  placeId: string;
  homeUrl: string;
  generatedAt: string;
  features: FeatureCheck[];
};

export function normalizePlaceIdArg(arg: string): string {
  if (/^\d+$/.test(arg)) return arg;
  return extractPlaceId(arg);
}

export async function probePlace(rawArg: string): Promise<ProbeResult> {
  const placeId = normalizePlaceIdArg(rawArg);
  const homeUrl = `https://m.place.naver.com/place/${placeId}/home`;

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

    await page.goto(homeUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(3000);

    const bodyText = await page.locator("body").innerText({ timeout: 8000 });

    const anchors: ProbeAnchor[] = await page.$$eval("a[href]", (els) =>
      els.map((el) => ({
        text: (el.textContent || "").trim().slice(0, 60),
        href: (el as HTMLAnchorElement).href,
      })),
    );

    const tabsRaw: string[] = await page.$$eval(
      "[role='tab'], [role='button'], button",
      (els) =>
        els
          .map((el) => (el.textContent || "").trim())
          .filter((t) => t.length > 0 && t.length < 30),
    );

    const lines = bodyText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const tabs = Array.from(new Set(tabsRaw));

    // 쿠폰 제목·증정내용 추출 (홈 본문에서)
    const couponInfo = extractCouponInfo(lines);

    // 스마트콜: 홈 페이지에서 보이는 모든 tel 링크 + "2차 대표번호" 탐색
    const smartcallInfo = extractSmartcallInfo(lines, anchors);

    // 예약 메뉴 수집 (booking 페이지 방문)
    const bookingAnchor = anchors.find((a) =>
      /\/booking(\?|$|\/)/.test(a.href) || a.href.includes("booking.naver.com"),
    );
    let bookingInfo: BookingInfo | null = null;
    if (bookingAnchor) {
      try {
        bookingInfo = await collectBookingInfo(page, bookingAnchor.href);
      } catch (err) {
        console.error("[probe] booking info failed", err);
      }
    }

    // 소식 피드 링크가 있으면 피드 페이지로 이동해 카운트/최신일 수집
    const feedAnchor = anchors.find((a) =>
      /\/feed($|\?)/.test(a.href.replace(/#.*$/, "")),
    );
    let feedInfo: FeedInfo | null = null;
    if (feedAnchor) {
      try {
        feedInfo = await collectFeedInfo(page, feedAnchor.href);
      } catch (err) {
        console.error("[probe] feed info failed", err);
      }
    }

    const features = detectFeatures(
      lines,
      anchors,
      tabs,
      feedInfo,
      couponInfo,
      bookingInfo,
      smartcallInfo,
    );

    return {
      placeId,
      homeUrl,
      generatedAt: new Date().toISOString(),
      features,
    };
  } finally {
    await browser.close();
  }
}

function extractCouponInfo(lines: string[]): CouponInfo | null {
  // 패턴: "알림받기한 고객님들께 드려요" 다음 줄이 쿠폰 내용
  // 또는 "혜택" / "쿠폰" 섹션 헤더 다음 줄.
  const anchors = [
    "알림받기한 고객님들께",
    "알림받기 혜택",
    "혜택",
  ];
  for (const anchor of anchors) {
    const idx = lines.findIndex((l) => l.includes(anchor));
    if (idx < 0) continue;
    // 다음 non-trivial 라인 (짧은 단일 버튼 텍스트 제외)
    for (let j = idx + 1; j < Math.min(lines.length, idx + 6); j++) {
      const next = lines[j];
      if (!next) continue;
      if (/^(다운로드|알림받기|확인|더보기|받기|닫기)$/.test(next)) continue;
      if (next.length < 4) continue;
      return { title: lines[idx], content: next };
    }
  }
  return null;
}

function extractSmartcallInfo(
  lines: string[],
  anchors: ProbeAnchor[],
): SmartcallInfo {
  const VIRTUAL_RE =
    /^tel:(0507|1522|1566|1577|1588|1599|1600|1644|1661|1666|1670|1688|1800)/;
  const tels = anchors
    .filter((a) => a.href.startsWith("tel:"))
    .map((a) => a.href.replace(/^tel:/, ""));
  const uniq = Array.from(new Set(tels));

  const primary =
    uniq.find((t) =>
      VIRTUAL_RE.test(`tel:${t}`),
    ) ?? uniq[0] ?? null;

  // 2차 대표번호: primary 외에 다른 번호가 있거나, 본문에 "2차" 키워드가 함께 등장
  const secondaryCandidate = uniq.find((t) => t !== primary) ?? null;
  const hasSecondLabel = lines.some(
    (l) => l.includes("2차 번호") || l.includes("2차 대표번호"),
  );

  const secondary = secondaryCandidate || (hasSecondLabel ? "(라벨만 감지)" : null);

  return { primary, secondary, allTels: uniq };
}

async function collectBookingInfo(
  page: Page,
  bookingUrl: string,
): Promise<BookingInfo> {
  const cleanUrl = bookingUrl.replace(/#.*$/, "").replace(/\?.*$/, "");
  await page.goto(cleanUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2500);

  // 추가 로드 위해 스크롤
  for (let i = 0; i < 4; i++) {
    let prev: number;
    try {
      prev = await page.evaluate(() => document.body.scrollHeight);
    } catch {
      break;
    }
    try {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    } catch {
      /* ignore */
    }
    await page.waitForTimeout(700);
    let curr: number;
    try {
      curr = await page.evaluate(() => document.body.scrollHeight);
    } catch {
      break;
    }
    if (curr === prev) break;
  }

  const body = await page.locator("body").innerText({ timeout: 8000 });
  const lines = body
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // 예약 메뉴 아이템 추출 전략:
  // 1) "예약 메뉴" / "예약 상품" / "상품 선택" / "메뉴 선택" 같은 섹션 헤더를 찾고
  //    그 이후 라인에서 가격("원"을 포함)과 함께 있는 상품명을 추출한다.
  // 2) 섹션 헤더가 없으면 시간-기반 방문 예약으로 간주.
  const SECTION_HEADS = [
    "예약 메뉴",
    "예약 상품",
    "상품 선택",
    "메뉴 선택",
    "예약상품",
    "예약메뉴",
  ];
  const SECTION_END = [
    "리뷰",
    "매장 정보",
    "공지",
    "유의사항",
    "예약 안내",
    "이용 안내",
    "취소",
    "고객센터",
    "매장 위치",
  ];

  const startIdx = lines.findIndex((l) =>
    SECTION_HEADS.some((h) => l === h || l.startsWith(h)),
  );

  const items: string[] = [];
  const priceInlineRe = /[\d,]+\s*원/;
  const priceOnlyRe = /^[\d,]+\s*원$/;

  if (startIdx >= 0) {
    for (let i = startIdx + 1; i < lines.length; i++) {
      const l = lines[i];
      if (SECTION_END.some((h) => l === h || l.startsWith(h))) break;
      if (!priceInlineRe.test(l)) continue;
      if (priceOnlyRe.test(l)) {
        // 앞줄을 메뉴명으로
        const name = lines[i - 1];
        if (
          name &&
          name.length > 1 &&
          !priceInlineRe.test(name) &&
          !/^(예약|인원|날짜|시간|선택|확인|닫기|이전|다음|총|합계)$/.test(name)
        ) {
          items.push(`${name} ${l}`);
        }
      } else if (l.length > 3 && l.length < 120) {
        items.push(l);
      }
    }
  }

  const uniqItems = Array.from(new Set(items)).slice(0, 30);
  return { items: uniqItems, url: cleanUrl };
}

async function collectFeedInfo(
  page: Page,
  feedUrl: string,
): Promise<FeedInfo> {
  // 쿼리/프래그먼트 제거해 깔끔한 피드 리스트 URL
  const cleanUrl = feedUrl.replace(/#.*$/, "").replace(/\?.*$/, "");
  await page.goto(cleanUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);

  // 추가 로딩을 위해 몇 번 스크롤
  for (let i = 0; i < 6; i++) {
    let prev: number;
    try {
      prev = await page.evaluate(() => document.body.scrollHeight);
    } catch {
      break;
    }
    try {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    } catch {
      /* ignore */
    }
    await page.waitForTimeout(800);
    let curr: number;
    try {
      curr = await page.evaluate(() => document.body.scrollHeight);
    } catch {
      break;
    }
    if (curr === prev) break;
  }

  const body = await page.locator("body").innerText({ timeout: 8000 });
  const lines = body
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // 소식 피드의 각 카드는 "YYYY.MM.DD." (또는 "YY.MM.DD.") 형식의 날짜 라인을
  // 반드시 하나씩 포함한다. 이 날짜 라인의 개수 = 소식 작성 갯수.
  const shortRe = /^(\d{2}|\d{4})\.(\d{1,2})\.(\d{1,2})\.?$/;
  const longRe = /^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/;
  const dates: string[] = [];
  for (const l of lines) {
    const ms = l.match(shortRe);
    if (ms) {
      const yyyy = ms[1].length === 2 ? `20${ms[1]}` : ms[1];
      dates.push(
        `${yyyy}-${ms[2].padStart(2, "0")}-${ms[3].padStart(2, "0")}`,
      );
      continue;
    }
    const ml = l.match(longRe);
    if (ml) {
      dates.push(
        `${ml[1]}-${ml[2].padStart(2, "0")}-${ml[3].padStart(2, "0")}`,
      );
    }
  }

  const latestDate = [...dates].sort().reverse()[0] ?? null;

  return {
    count: dates.length,
    latestDate,
    feedUrl: cleanUrl,
  };
}

function detectFeatures(
  lines: string[],
  anchors: ProbeAnchor[],
  tabs: string[],
  feedInfo: FeedInfo | null,
  couponInfo: CouponInfo | null,
  bookingInfo: BookingInfo | null,
  smartcallInfo: SmartcallInfo,
): FeatureCheck[] {
  const body = lines.join("\n");

  // 예약: /booking 링크 존재
  const bookingAnchors = anchors.filter(
    (a) => /\/booking(\?|$|\/)/.test(a.href) || a.href.includes("booking.naver.com"),
  );

  // 톡톡(문의): talk.naver.com 링크
  const talkAnchors = anchors.filter((a) => a.href.includes("talk.naver.com"));

  // 스마트콜: tel:0507- 또는 tel:1522- / 1566- 등 가상번호
  const smartcallAnchors = anchors.filter((a) =>
    /^tel:(0507|1522|1566|1577|1588|1599|1600|1644|1661|1666|1670|1688|1800)/.test(
      a.href,
    ),
  );

  // 네이버페이 / 주문: order.pay.naver.com, /order, pay.naver.com
  const payAnchors = anchors.filter(
    (a) =>
      a.href.includes("order.pay.naver.com") ||
      a.href.includes("pay.naver.com") ||
      /\/order(\?|$|\/)/.test(a.href),
  );

  // 쿠폰: "쿠폰" 탭 or 본문 "알림받기한 고객님들께 드려요" or /benefit, /coupon
  const couponByTab = tabs.some((t) => t === "쿠폰") || body.includes("쿠폰");
  const couponByCta = body.includes("알림받기한 고객님들께");
  const couponAnchors = anchors.filter(
    (a) => a.href.includes("/coupon") || a.href.includes("/benefit"),
  );

  // 소식: "소식" 탭 존재 + /feed 링크
  const newsAnchors = anchors.filter((a) => /\/feed(\?|$|\/)/.test(a.href));

  // 사진 리뷰: 이미지 개수 카운트(본문 "이미지 갯수") + /photo 탭
  const photoAnchors = anchors.filter((a) => /\/photo(\?|$|\/)/.test(a.href));
  const hasPhotoCount = lines.some((l) => l.includes("이미지 갯수"));

  const features: FeatureCheck[] = [
    {
      key: "booking",
      label: "예약 (네이버 예약)",
      active: bookingAnchors.length > 0,
      evidence: bookingInfo
        ? bookingInfo.items.length > 0
          ? [`예약 메뉴 ${bookingInfo.items.length}건`, ...bookingInfo.items, bookingInfo.url]
          : ["시간 기반 방문 예약 (상품 메뉴 없음)", bookingInfo.url]
        : bookingAnchors.slice(0, 3).map((a) => a.href),
    },
    {
      key: "talk",
      label: "톡톡 문의",
      active: talkAnchors.length > 0,
      evidence: talkAnchors.slice(0, 3).map((a) => a.href),
    },
    {
      key: "smartcall",
      label: "스마트콜 (가상번호)",
      active: smartcallAnchors.length > 0,
      evidence: [
        smartcallInfo.primary
          ? `대표번호: ${smartcallInfo.primary}`
          : "대표번호 확인 불가",
        smartcallInfo.secondary
          ? `2차 대표번호: ${smartcallInfo.secondary} ✓`
          : "2차 대표번호: 미설정",
        ...(smartcallInfo.allTels.length > 2
          ? [`전체 tel 링크 ${smartcallInfo.allTels.length}개: ${smartcallInfo.allTels.join(", ")}`]
          : []),
      ],
    },
    {
      key: "naverpay",
      label: "네이버페이 주문",
      active: payAnchors.length > 0,
      evidence: payAnchors.slice(0, 3).map((a) => a.href),
    },
    {
      key: "order",
      label: "주문 (배달/포장)",
      active: payAnchors.some((a) => /\/order/.test(a.href)),
      evidence: payAnchors
        .filter((a) => /\/order/.test(a.href))
        .slice(0, 3)
        .map((a) => a.href),
    },
    {
      key: "coupon",
      label: "쿠폰 / 혜택",
      active: couponByTab || couponByCta || couponAnchors.length > 0,
      evidence: couponInfo
        ? [
            `제목: ${couponInfo.title}`,
            `증정내용: ${couponInfo.content}`,
          ]
        : [
            ...(couponByCta ? ["본문: 알림받기한 고객님들께 드려요"] : []),
            ...(couponByTab && !couponByCta ? ["탭/본문: 쿠폰"] : []),
            ...couponAnchors.slice(0, 2).map((a) => a.href),
          ],
    },
    {
      key: "news",
      label: "소식 (피드)",
      active: newsAnchors.length > 0,
      evidence: feedInfo
        ? [
            `소식 ${feedInfo.count}건`,
            feedInfo.latestDate
              ? `마지막 업로드: ${feedInfo.latestDate}`
              : "마지막 업로드: 확인 불가",
            feedInfo.feedUrl,
          ]
        : newsAnchors.slice(0, 3).map((a) => a.href),
    },
    {
      key: "photoReview",
      label: "사진/영상 리뷰",
      active: photoAnchors.length > 0 && hasPhotoCount,
      evidence: [
        ...(hasPhotoCount
          ? [lines.find((l) => l.includes("이미지 갯수")) ?? "이미지 갯수"]
          : []),
        ...photoAnchors.slice(0, 2).map((a) => a.href),
      ],
    },
  ];

  return features;
}
