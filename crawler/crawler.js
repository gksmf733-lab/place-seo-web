/**
 * 네이버 플레이스 리뷰 크롤러 (Stealth 강화 버전)
 * - puppeteer-extra + stealth 플러그인으로 자동화 탐지 회피
 * - User-Agent 랜덤 회전
 * - 클릭 사이 랜덤 지연 (사람처럼 보이게)
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const USER_AGENTS = {
  desktop: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  ],
  mobile: [
    'Mozilla/5.0 (Linux; Android 13; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 14; SM-S928N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  ],
};

function randomUserAgent(type = 'mobile') {
  const list = USER_AGENTS[type];
  return list[Math.floor(Math.random() * list.length)];
}

function randomDelay(min = 800, max = 2200) {
  const ms = Math.floor(Math.random() * (max - min) + min);
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractPlaceId(url) {
  const patterns = [
    /place\/(\d+)/,
    /restaurant\/(\d+)/,
    /hairshop\/(\d+)/,
    /place\?id=(\d+)/,
    /entry\/place\/(\d+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

async function resolveShortUrl(page, url) {
  if (!url.includes('naver.me')) return url;
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  return page.url();
}

async function crawlReviews(url, maxReviews = 100) {
  const ua = randomUserAgent('desktop');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--lang=ko-KR',
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.setUserAgent(ua);
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'ko-KR,ko;q=0.9' });

    const resolvedUrl = await resolveShortUrl(page, url);
    const placeId = extractPlaceId(resolvedUrl);
    if (!placeId) {
      throw new Error('URL에서 플레이스 ID를 찾을 수 없습니다.');
    }

    const reviewUrl = `https://pcmap.place.naver.com/restaurant/${placeId}/review/visitor`;
    await page.goto(reviewUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await randomDelay(2000, 3000);

    const isErrorPage = await page.evaluate(() =>
      document.body.innerText.includes('페이지를 찾을 수 없습니다') ||
      document.body.innerText.includes('잘못된 접근')
    );

    if (isErrorPage) {
      const categories = ['cafe', 'hairshop', 'beauty', 'place', 'accommodation'];
      let success = false;
      for (const cat of categories) {
        const tryUrl = `https://pcmap.place.naver.com/${cat}/${placeId}/review/visitor`;
        await page.goto(tryUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        await randomDelay(800, 1500);
        const stillError = await page.evaluate(() =>
          document.body.innerText.includes('페이지를 찾을 수 없습니다')
        );
        if (!stillError) { success = true; break; }
      }
      if (!success) throw new Error('해당 플레이스의 리뷰 페이지에 접근할 수 없습니다.');
    }

    const placeName = await page.evaluate(() => {
      const el = document.querySelector('span.GHAhO, .Fc1rA, .place_bluelink');
      return el ? el.innerText.trim() : '알 수 없음';
    }).catch(() => '알 수 없음');

    // ===== 더보기 클릭으로 리뷰 로드 =====
    let previousCount = 0;
    let stableCount = 0;
    const maxClicks = Math.ceil(maxReviews / 10) + 10;

    for (let i = 0; i < maxClicks; i++) {
      const currentCount = await page.evaluate(() =>
        document.querySelectorAll('li.place_apply_pui, li.EjjAW').length
      );

      console.log(`  [로드] ${currentCount}개 로드됨 (목표: ${maxReviews})`);
      if (currentCount >= maxReviews) break;

      if (currentCount === previousCount) {
        stableCount++;
        if (stableCount >= 5) break;
      } else {
        stableCount = 0;
      }
      previousCount = currentCount;

      // "펼쳐서 더보기" 버튼 (a.fvwqf) 클릭
      const hasMoreBtn = await page.evaluate(() => {
        const btn = document.querySelector('a.fvwqf');
        if (btn) {
          btn.scrollIntoView({ block: 'center' });
          return true;
        }
        return false;
      });

      if (hasMoreBtn) {
        await randomDelay(300, 600);
        try {
          await page.click('a.fvwqf');
        } catch (e) {
          await page.evaluate(() => {
            const btn = document.querySelector('a.fvwqf');
            if (btn) btn.click();
          });
        }
      } else {
        // 버튼이 없으면 스크롤 시도 (무한 스크롤 폴백)
        await page.evaluate(() => window.scrollBy(0, 800));
      }

      await randomDelay(1500, 2500);
    }

    // ===== 리뷰 데이터 + profileId/reviewId 추출 =====
    // reviewGroupIds 캡처 (더보기 클릭마다 새 PATCH 요청 발생)
    const allReviewIds = [];
    page.on('request', (req) => {
      if (req.url().includes('visitorReview/views') && req.postData()) {
        try {
          const data = JSON.parse(req.postData());
          if (data.reviewGroupIds) allReviewIds.push(...data.reviewGroupIds);
        } catch (e) {}
      }
    });

    // 이미 로드된 첫 배치의 reviewIds는 캡처 못했으므로 다시 한번 로드
    await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
    await randomDelay(2000, 3000);

    // 다시 더보기 클릭으로 리뷰 로드
    previousCount = 0;
    stableCount = 0;
    for (let i = 0; i < maxClicks; i++) {
      const currentCount = await page.evaluate(() =>
        document.querySelectorAll('li.place_apply_pui, li.EjjAW').length
      );
      if (currentCount >= maxReviews) break;
      if (currentCount === previousCount) {
        stableCount++;
        if (stableCount >= 5) break;
      } else {
        stableCount = 0;
      }
      previousCount = currentCount;

      const hasMoreBtn = await page.evaluate(() => {
        const btn = document.querySelector('a.fvwqf');
        if (btn) { btn.scrollIntoView({ block: 'center' }); return true; }
        return false;
      });
      if (hasMoreBtn) {
        await randomDelay(300, 600);
        try { await page.click('a.fvwqf'); } catch (e) {
          await page.evaluate(() => { const b = document.querySelector('a.fvwqf'); if (b) b.click(); });
        }
      } else {
        await page.evaluate(() => window.scrollBy(0, 800));
      }
      await randomDelay(1500, 2500);
    }

    // ===== 키워드 전체 펼치기 ("+N" 버튼 클릭) =====
    await page.evaluate(() => {
      document.querySelectorAll('a[data-pui-click-code="keywordmore"]').forEach(b => b.click());
    });
    await randomDelay(1000, 1500);

    const reviews = await page.evaluate((limit) => {
      const items = document.querySelectorAll('li.place_apply_pui, li.EjjAW');
      const results = [];

      items.forEach((item, idx) => {
        if (idx >= limit) return;

        // 계정 (닉네임)
        const authorEl = item.querySelector('.pui__NMi-Dp, .pui__JiVbY3');
        const author = authorEl ? authorEl.innerText.trim() : '';

        // 프로필 ID (조회수 조회용)
        let profileId = null;
        const profileLink = item.querySelector('a[data-pui-click-code="profile"]');
        if (profileLink) {
          const m = profileLink.href.match(/my\/([a-f0-9]+)\//);
          if (m) profileId = m[1];
        }

        // 본문
        let content = '';
        const contentEl = item.querySelector('div.pui__vn15t2 a[data-pui-click-code="rvshowmore"]');
        if (contentEl) content = contentEl.innerText.trim();
        if (!content) {
          const contentEls = item.querySelectorAll('a.pui__GStJHb');
          contentEls.forEach(el => {
            const text = el.innerText?.trim();
            if (text && text.length > 10 && text !== '팔로우' &&
                !el.classList.contains('pui__I07xq6') && !el.classList.contains('pui__sG3Q0N') &&
                !el.classList.contains('pui__uqSlGl')) {
              if (!content || text.length > content.length) content = text;
            }
          });
        }

        // 방문일 (span.pui__blind에서 "년 월 일" 패턴)
        let visitDate = '';
        const blindSpans = item.querySelectorAll('span.pui__blind');
        blindSpans.forEach(s => {
          const txt = s.innerText.trim();
          if (!visitDate && txt.match(/\d{4}년\s*\d{1,2}월\s*\d{1,2}일/)) {
            visitDate = txt;
          }
        });

        // 방문 정보 (방문시간대, 예약여부, 대기시간, 방문목적, 동행)
        const visitInfoEl = item.querySelector('a[data-pui-click-code="visitkeywords"]');
        const visitTags = [];
        if (visitInfoEl) {
          visitInfoEl.querySelectorAll('span.pui__V8F9nN').forEach(s => {
            const txt = s.innerText.trim();
            if (txt) visitTags.push(txt);
          });
        }

        // 방문 정보 분류 — 실제 Naver 태그 30건 표본 분석 기반.
        //
        //   visitTime   : "...에 방문"    (점심에/저녁에/밤에/아침에 방문)
        //   reservation : "예약 ..."        (예약 후 이용 / 예약 없이 이용)
        //                 "...이용"          (포장·배달 이용 등 이용 형태)
        //   waitTime    : "...입장|대기..." (바로 입장 / 대기 시간 N분 ...)
        //   companions  : "...・..." (전각 가운뎃점 U+30FB)         — 연인・배우자, 친척・형제자매
        //                 "함께"                                   — 가족과 함께
        //                 명시적 명사 (부모님/자녀/친구/...)
        //   purpose     : 그 외 모든 태그 (일상/데이트/친목/나들이/...)
        let visitTime = null;
        let reservation = null;
        let waitTime = null;
        let purpose = null;
        let companions = null;

        const COMPANION_EXACT = new Set([
          '혼자', '단체',
          '부모님', '자녀', '아이', '아이들',
          '친구', '동료', '가족', '지인',
          '연인', '배우자', '친척', '형제', '자매', '형제자매',
          '반려동물',
        ]);

        const classify = (tag) => {
          if (tag.includes('에 방문')) return 'visitTime';
          if (tag.includes('예약')) return 'reservation';
          if (tag.includes('입장') || tag.includes('대기')) return 'waitTime';
          if (tag.endsWith('이용')) return 'reservation';            // 포장·배달 이용 등
          if (tag.includes('・') || tag.includes('함께')) return 'companions'; // 연인・배우자
          if (COMPANION_EXACT.has(tag)) return 'companions';
          return 'purpose';                                          // catch-all
        };

        const append = (current, tag) => (current ? current + ', ' + tag : tag);

        // Naver 는 동행이 여러 개면 단일 태그 안에 ", "로 join 해서 주는 경우가 있다
        // (예: "부모님, 아이" 한 덩어리). split 후 각 sub-tag 를 개별 분류.
        visitTags.forEach((rawTag) => {
          rawTag.split(',').map((s) => s.trim()).filter(Boolean).forEach((tag) => {
            switch (classify(tag)) {
              case 'visitTime':   visitTime   = append(visitTime, tag); break;
              case 'reservation': reservation = append(reservation, tag); break;
              case 'waitTime':    waitTime    = append(waitTime, tag); break;
              case 'companions':  companions  = append(companions, tag); break;
              default:            purpose     = append(purpose, tag);
            }
          });
        });

        // 키워드 태그 (디저트가 맛있어요 등)
        const keywords = [];
        const keywordMainEl = item.querySelector('.pui__HLNvmI');
        if (keywordMainEl) {
          keywordMainEl.querySelectorAll('span.pui__jhpEyP').forEach(el => {
            const txt = el.innerText.trim();
            if (txt) keywords.push(txt);
          });
        }

        // 방문 횟수
        let visitCount = null;
        // 인증 수단
        let authMethod = null;
        item.querySelectorAll('.pui__gfuUIT').forEach(s => {
          const txt = s.innerText.trim();
          if (txt.includes('번째 방문')) visitCount = txt;
          else if (txt.includes('인증 수단')) {
            authMethod = txt.replace('인증 수단', '').trim();
          }
        });

        if (content || visitDate) {
          results.push({
            // 어드민 API mapReview 와 키 이름 일치 (account / companions / authMethod)
            account: author || null,
            profileId,
            visitDate: visitDate || '(날짜 없음)',
            visitTime,
            reservation,
            waitTime,
            purpose,
            companions,
            content: content || '(본문 없음)',
            keywords: keywords.length > 0 ? keywords.join(', ') : null,
            visitCount: visitCount || null,
            authMethod: authMethod || null,
            viewCount: null, // 나중에 채움
          });
        }
      });

      return results;
    }, maxReviews);

    // ===== 조회수 일괄 조회 =====
    console.log(`  [조회수] ${reviews.length}개 리뷰의 조회수 조회 중...`);

    // reviewIds 매핑 (캡처된 순서 = 리뷰 순서)
    const uniqueReviewIds = [...new Set(allReviewIds)];

    if (uniqueReviewIds.length > 0 && reviews.length > 0) {
      // reviewfeed 페이지로 이동 (fetch 호출을 위한 도메인 컨텍스트)
      const firstProfile = reviews.find(r => r.profileId)?.profileId;
      const firstReviewId = uniqueReviewIds[0];
      if (firstProfile && firstReviewId) {
        await page.goto(
          `https://m.place.naver.com/my/${firstProfile}/reviewfeed?reviewId=${firstReviewId}`,
          { waitUntil: 'networkidle2', timeout: 30000 }
        );
        await randomDelay(1000, 2000);

        // 각 리뷰의 조회수를 fetch로 조회 (5개씩 배치)
        const batchSize = 5;
        for (let i = 0; i < reviews.length; i += batchSize) {
          const batch = reviews.slice(i, i + batchSize);
          const pairs = batch.map((r, j) => ({
            idx: i + j,
            profileId: r.profileId,
            reviewId: uniqueReviewIds[i + j] || null,
          })).filter(p => p.profileId && p.reviewId);

          const viewCounts = await page.evaluate(async (pairs) => {
            const results = {};
            await Promise.all(pairs.map(async ({ idx, profileId, reviewId }) => {
              try {
                const res = await fetch(`/my/${profileId}/reviewfeed?reviewId=${reviewId}`);
                const html = await res.text();
                const match = html.match(/viewCount[":]+(\d+)/);
                results[idx] = match ? parseInt(match[1]) : null;
              } catch (e) {
                results[idx] = null;
              }
            }));
            return results;
          }, pairs);

          for (const [idx, count] of Object.entries(viewCounts)) {
            reviews[parseInt(idx)].viewCount = count;
          }

          if (i + batchSize < reviews.length) {
            await randomDelay(500, 1000);
          }
        }
      }
    }

    console.log(`  [조회수] 완료`);

    // profileId는 내부용이므로 결과에서 제거
    reviews.forEach(r => delete r.profileId);

    return {
      place: { id: placeId, name: placeName, url: resolvedUrl },
      reviews,
      totalCollected: reviews.length,
      crawledAt: new Date().toISOString(),
      userAgent: ua,
    };
  } finally {
    await browser.close();
  }
}

module.exports = { crawlReviews, extractPlaceId };
