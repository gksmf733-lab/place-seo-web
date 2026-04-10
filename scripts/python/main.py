"""
플레이스 SEO 최적화 작업지 생성기 (PoC #1)

사용법:
    uv run main.py <네이버 플레이스 URL>

예:
    uv run main.py https://map.naver.com/p/entry/place/1813683490

동작:
    1. URL에서 place ID 추출
    2. 네이버 모바일 플레이스 페이지를 Playwright로 열기
    3. 페이지 본문 텍스트에서 라벨 기반으로 필드 추출
       (CSS 해시 클래스 의존을 피하고 "주소", "전화번호" 등 한국어 라벨을 앵커로 사용)
    4. sections/*.yaml 의 프롬프트 템플릿 로드
    5. 추출 정보와 프롬프트를 결합하여 output/{place_id}.md 생성
"""

from __future__ import annotations

import asyncio
import re
import sys
from pathlib import Path
from typing import Any

import yaml
from playwright.async_api import async_playwright


PLACE_ID_PATTERN = re.compile(r"/place/(\d+)")
RAW_EXCERPT_LIMIT = 2000

# ----------------------------------------------------------------------------
# 1. 노이즈 필터 (display 용 raw_text 정제)
# ----------------------------------------------------------------------------

NOISE_LINES: set[str] = {
    "이전 페이지", "마이플레이스", "알림받기", "저장", "길찾기", "공유", "예약",
    "홈", "소식", "메뉴", "리뷰", "사진", "지도", "주변", "정보", "쿠폰",
    "전화", "문의", "안내", "복사", "인스타그램", "홈페이지", "편의", "내부",
    "외부", "음식·음료", "메뉴판", "알림", "다운로드", "이미지 갯수", "별점",
    "찾아가는길", "내용 더보기", "영업시간", "펼쳐보기", "전화번호", "주소",
    "더보기", "AI 브리핑", "실험 단계로 정확하지 않을 수 있어요.",
    "이용약관고객센터리뷰운영정책신고센터", "네이버", "카테고리", "999+",
    "메뉴판 이미지로 보기", "영업 종료", "영업 중", "가격표", "가격표 이미지로 보기",
}

NOISE_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"^\d+$"),                          # 1, 2, 3 (리뷰 인덱스)
    re.compile(r"^\d{2}\.\d{2}\.\d{2}\.?$"),       # 25.07.31.
    re.compile(r"^\d{4}년 \d{1,2}월 \d{1,2}일"),    # 2025년 07월 31일
    re.compile(r"^메뉴\d*$"),                      # 메뉴20
]


def clean_raw_text(text: str) -> str:
    """표시용 본문에서 UI 노이즈·중복 줄을 제거."""
    if not text:
        return ""
    lines = [line.strip() for line in text.split("\n")]
    seen: set[str] = set()
    cleaned: list[str] = []
    for line in lines:
        if not line or len(line) < 2:
            continue
        if line in NOISE_LINES:
            continue
        if any(p.match(line) for p in NOISE_PATTERNS):
            continue
        if line in seen:
            continue
        seen.add(line)
        cleaned.append(line)
    return "\n".join(cleaned)


# ----------------------------------------------------------------------------
# 2. 라벨 기반 필드 추출 (핵심)
# ----------------------------------------------------------------------------

TIME_PATTERN = re.compile(r"\d{1,2}:\d{2}")
KOREAN_TIME_PATTERN = re.compile(r"\d{1,2}시\s*\d{1,2}분")
PHONE_PATTERN = re.compile(r"[\d][\d\-]{7,}")
PRICE_PATTERN = re.compile(r"^[\d,]+원$")
# 별점은 옵션: "4.84방문자 리뷰 2,806블로그 리뷰 815" 또는 "방문자 리뷰 177블로그 리뷰 277"
RATING_PATTERN = re.compile(
    r"^(?:(\d\.\d+))?방문자 리뷰\s*([\d,]+).*?블로그 리뷰\s*([\d,]+)"
)
CLOSED_DAY_PATTERN = re.compile(r"매주\s*[월화수목금토일]요일\s*휴무")
URL_PATTERN = re.compile(r"https?://[^\s]+")


def _nonempty_lines(text: str) -> list[str]:
    return [line.strip() for line in text.split("\n") if line.strip()]


def _find_line_index(lines: list[str], label: str) -> int:
    """정확히 일치하는 라벨의 첫 인덱스. 없으면 -1."""
    for i, line in enumerate(lines):
        if line == label:
            return i
    return -1


def _extract_address(lines: list[str]) -> str:
    i = _find_line_index(lines, "주소")
    if i < 0 or i + 1 >= len(lines):
        return ""
    # "경기 안양시 동안구 동편로49번길 26 102호지도내비게이션거리뷰" 형태에서 꼬리표 제거
    raw = lines[i + 1]
    return re.sub(r"(지도|내비게이션|거리뷰).*$", "", raw).strip()


def _extract_phone(lines: list[str]) -> str:
    i = _find_line_index(lines, "전화번호")
    if i < 0:
        return ""
    # 라벨 이후 5줄 내에서 전화번호 패턴
    for j in range(i + 1, min(i + 5, len(lines))):
        m = PHONE_PATTERN.match(lines[j])
        if m:
            return m.group(0)
    return ""


def _extract_hours(lines: list[str]) -> str:
    """
    영업시간 추출. 전략:
    1) "영업시간" 라벨이 있으면 이후 8줄 내 시각 패턴 줄
    2) 라벨이 없으면 전체에서 시각 패턴 + 휴무 정보 조합
    """
    i = _find_line_index(lines, "영업시간")
    if i >= 0:
        for j in range(i + 1, min(i + 8, len(lines))):
            if TIME_PATTERN.search(lines[j]) or KOREAN_TIME_PATTERN.search(lines[j]):
                return lines[j]

    # 폴백: 페이지 전체에서 시각/휴무 패턴 수집
    time_line = ""
    closed_line = ""
    for line in lines[:150]:  # 상단 150줄 내만 (리뷰 영역 제외)
        if not time_line and (TIME_PATTERN.search(line) or KOREAN_TIME_PATTERN.search(line)):
            if "영업" in line or "영업 종료" in line or len(line) < 40:
                time_line = line
        if not closed_line and CLOSED_DAY_PATTERN.search(line):
            closed_line = line
        if time_line and closed_line:
            break

    parts = [p for p in (time_line, closed_line) if p]
    return " · ".join(parts)


def _extract_homepage(lines: list[str]) -> str:
    """
    홈페이지 추출. 전략:
    1) "홈페이지" 라벨 다음 줄
    2) 폴백: 페이지 내 http URL 중 naver.com/search 류가 아닌 첫 번째
    """
    i = _find_line_index(lines, "홈페이지")
    if i >= 0 and i + 1 < len(lines):
        candidate = lines[i + 1]
        if candidate.startswith("http"):
            return candidate

    # 폴백: 원문에서 http URL 수집 (SNS/예약/스토어 링크 포함)
    for line in lines:
        m = URL_PATTERN.search(line)
        if m:
            url = m.group(0).rstrip(",.)")
            # 내비게이션용 네이버 검색 URL은 제외
            if "search.naver.com" in url or "map.naver.com" in url:
                continue
            return url
    return ""


def _extract_amenities(lines: list[str]) -> str:
    i = _find_line_index(lines, "편의")
    if i < 0 or i + 1 >= len(lines):
        return ""
    candidate = lines[i + 1]
    # 다음 줄이 콤마나 "가능" 등을 포함해야 유효
    if "," in candidate or "가능" in candidate or "포장" in candidate:
        return candidate
    return ""


def _extract_rating(lines: list[str]) -> tuple[str, str, str]:
    """(평점, 방문자 리뷰 수, 블로그 리뷰 수) — 별점 없는 업체도 지원."""
    for line in lines[:50]:
        m = RATING_PATTERN.match(line)
        if m:
            score = m.group(1) or ""
            return score, m.group(2), m.group(3)
    return "", "", ""


def _extract_name_category(lines: list[str]) -> tuple[str, str]:
    """
    페이지 상단에서 업체명과 카테고리를 동시 추출.
    패턴: "에그룸" 단독 줄이 있고, 그 근처에 "에그룸카페,디저트" 같은 합쳐진 줄이 존재.
    """
    for i, line in enumerate(lines[:15]):
        if len(line) > 30 or len(line) < 1:
            continue
        # 이 줄 뒤 10줄 내에, 이 줄로 시작하되 뒤에 추가 텍스트가 붙은 줄 탐색
        for j in range(i + 1, min(i + 12, len(lines))):
            candidate = lines[j]
            if candidate == line:
                continue
            if candidate.startswith(line) and len(candidate) > len(line):
                category = candidate[len(line):].strip()
                # 카테고리는 한글/쉼표/슬래시 등으로 구성되어야 함
                if category and all(
                    c.isalpha() or c in ",/·· " for c in category
                ):
                    return line, category
    return "", ""


def _extract_ai_brief(lines: list[str]) -> str:
    """AI 브리핑(리뷰 요약)을 소개글 폴백으로 사용."""
    anchor = "리뷰를 기반으로 주요 특징을 정리하면 다음과 같습니다."
    i = -1
    for idx, line in enumerate(lines):
        if anchor in line:
            i = idx
            break
    if i < 0:
        return ""
    brief: list[str] = []
    for j in range(i + 1, min(i + 20, len(lines))):
        line = lines[j]
        # 내부/외부/메뉴판 같은 섹션 헤더에서 중단
        if line in {"내부", "외부", "음식·음료", "메뉴판"}:
            break
        # 날짜 시작 줄에서 중단 (리뷰 리스트 진입)
        if re.match(r"^\d{2}\.\d{2}\.\d{2}", line):
            break
        if re.match(r"^\d{4}년", line):
            break
        if re.match(r"^\d+$", line):
            continue
        if len(line) >= 15:
            brief.append(line)
        if len(brief) >= 4:
            break
    return " ".join(brief)


MENU_BADGES: set[str] = {"대표", "추천", "NEW", "인기", "신규", "BEST", "베스트"}
MENU_NAME_HARD_CAP = 35   # 이보다 길면 무조건 설명으로 간주

# 메뉴명 후보에서 즉시 배제할 키워드
MENU_NAME_EXCLUDE = ("쿠폰", "주소", "리뷰", "블로그", "이미지로 보기", "가격표", "사진")


def _extract_menu_items(lines: list[str]) -> list[str]:
    """
    메뉴 아이템 + 가격 쌍 추출.

    두 가지 레이아웃 지원:
    - 홈 페이지: {name}\\n{price}원  (단순)
    - /menu/list: [{대표}\\n]{name}\\n{긴 설명}\\n{price}원  (설명이 중간에 있음)

    전략:
    - 가격/변동 라인에서 뒤로 최대 5줄 스캔하여 "후보"들을 수집
    - 노이즈·배지·이전 가격은 제외
    - 실제 이름은 설명보다 항상 짧으므로 수집된 후보 중 "가장 짧은" 것을 채택
    - 하드캡(35자) 초과는 이름이 아님
    """
    items: list[str] = []
    seen_names: set[str] = set()
    for i, line in enumerate(lines):
        is_price = bool(PRICE_PATTERN.match(line))
        is_variable = line == "변동"
        if not (is_price or is_variable):
            continue
        if i == 0:
            continue

        candidates: list[str] = []
        for back in range(1, 6):
            idx = i - back
            if idx < 0:
                break
            cand = lines[idx]
            # 이전 아이템의 가격/변동에 도달하면 중단
            if PRICE_PATTERN.match(cand) or cand == "변동":
                break
            if cand in NOISE_LINES or cand in MENU_BADGES:
                continue
            if any(kw in cand for kw in MENU_NAME_EXCLUDE):
                continue
            if len(cand) < 2:
                continue
            candidates.append(cand)

        if not candidates:
            continue

        # 가장 짧은 후보 = 이름 (설명은 항상 더 김)
        name = min(candidates, key=len)
        if len(name) > MENU_NAME_HARD_CAP:
            continue
        if name in seen_names:
            continue
        seen_names.add(name)
        items.append(f"{name} · {line}")
        if len(items) >= 60:
            break
    return items


def extract_fields(raw_body: str) -> dict[str, Any]:
    """페이지 본문(정제 전)에서 구조화된 필드 추출."""
    lines = _nonempty_lines(raw_body)

    name, category = _extract_name_category(lines)
    rating, visitor_reviews, blog_reviews = _extract_rating(lines)

    return {
        "name": name,
        "category": category,
        "address": _extract_address(lines),
        "phone": _extract_phone(lines),
        "hours": _extract_hours(lines),
        "homepage": _extract_homepage(lines),
        "amenities": _extract_amenities(lines),
        "rating": rating,
        "visitor_reviews": visitor_reviews,
        "blog_reviews": blog_reviews,
        "description": _extract_ai_brief(lines),
        "menu_items": _extract_menu_items(lines),
    }


# ----------------------------------------------------------------------------
# 3. 스크래퍼
# ----------------------------------------------------------------------------


def extract_place_id(url: str) -> str:
    match = PLACE_ID_PATTERN.search(url)
    if not match:
        raise ValueError(f"URL에서 place ID를 찾지 못했습니다: {url}")
    return match.group(1)


async def _load_all_menu_items(page, max_rounds: int = 20) -> None:
    """
    메뉴 페이지에서 스크롤 + '더보기' 클릭을 반복하여 lazy-loaded/접힌 아이템을 모두 로드.
    - 매 라운드: 끝까지 스크롤 → 잠깐 대기 → 보이는 '더보기' 클릭 → 높이 변화 측정
    - 높이 변화가 없으면 종료 (안정 상태)
    """
    for _ in range(max_rounds):
        try:
            prev_height = await page.evaluate("document.body.scrollHeight")
        except Exception:
            break

        try:
            await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        except Exception:
            pass
        await page.wait_for_timeout(700)

        # '더보기' 버튼/링크 클릭 시도 (정확히 "더보기" 텍스트만)
        try:
            more = page.get_by_text("더보기", exact=True)
            count = await more.count()
            if count > 0:
                target = more.last  # 메뉴 리스트의 '더보기'는 보통 아래쪽
                try:
                    if await target.is_visible(timeout=800):
                        await target.click(timeout=2000)
                        await page.wait_for_timeout(900)
                except Exception:
                    pass
        except Exception:
            pass

        try:
            curr_height = await page.evaluate("document.body.scrollHeight")
        except Exception:
            break
        if curr_height == prev_height:
            break


async def scrape_place(url: str) -> dict[str, Any]:
    place_id = extract_place_id(url)
    home_url = f"https://m.place.naver.com/place/{place_id}/home"
    menu_url = f"https://m.place.naver.com/place/{place_id}/menu/list"

    data: dict[str, Any] = {
        "place_id": place_id,
        "input_url": url,
        "scraped_url": home_url,
        "name": "",
        "category": "",
        "address": "",
        "phone": "",
        "hours": "",
        "homepage": "",
        "amenities": "",
        "rating": "",
        "visitor_reviews": "",
        "blog_reviews": "",
        "description": "",
        "menu_items": [],
        "raw_text": "",
        "errors": [],
    }

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        try:
            context = await browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) "
                    "AppleWebKit/605.1.15 (KHTML, like Gecko) "
                    "Version/16.0 Mobile/15E148 Safari/604.1"
                ),
                viewport={"width": 390, "height": 844},
                locale="ko-KR",
            )
            page = await context.new_page()

            # ----- Step 1: 홈 페이지에서 메인 필드 수집 -----
            try:
                await page.goto(home_url, wait_until="domcontentloaded", timeout=30000)
                await page.wait_for_timeout(2500)
            except Exception as exc:
                data["errors"].append(f"홈 페이지 이동 실패: {exc}")
                return data

            try:
                raw_body = await page.locator("body").inner_text(timeout=5000)
            except Exception as exc:
                data["errors"].append(f"홈 본문 추출 실패: {exc}")
                return data

            extracted = extract_fields(raw_body)
            data.update(extracted)
            data["raw_text"] = clean_raw_text(raw_body)[:RAW_EXCERPT_LIMIT]

            # ----- Step 2: 메뉴 전용 페이지에서 전체 메뉴 수집 (best-effort) -----
            try:
                await page.goto(menu_url, wait_until="domcontentloaded", timeout=20000)
                await page.wait_for_timeout(1500)
                await _load_all_menu_items(page)
                menu_body = await page.locator("body").inner_text(timeout=8000)
                full_menu = _extract_menu_items(_nonempty_lines(menu_body))
                if len(full_menu) > len(data["menu_items"]):
                    data["menu_items"] = full_menu
            except Exception as exc:
                data["errors"].append(f"메뉴 페이지 처리 실패 (홈 페이지 메뉴는 유지): {exc}")

        finally:
            await browser.close()

    return data


# ----------------------------------------------------------------------------
# 4. 섹션 로드
# ----------------------------------------------------------------------------


def load_sections(sections_dir: Path) -> list[dict[str, Any]]:
    if not sections_dir.exists():
        return []
    sections: list[dict[str, Any]] = []
    for f in sorted(sections_dir.glob("*.yaml")):
        with f.open(encoding="utf-8") as fp:
            sec = yaml.safe_load(fp)
            if isinstance(sec, dict):
                sec["_source_file"] = f.name
                sections.append(sec)
    sections.sort(key=lambda s: s.get("order", 999))
    return sections


# ----------------------------------------------------------------------------
# 5. 마크다운 렌더링
# ----------------------------------------------------------------------------


def format_place_data_block(data: dict[str, Any]) -> str:
    def or_missing(v: str) -> str:
        return v if v else "(추출 실패)"

    # 별점이 있으면 "4.84 (방문자 2806, 블로그 815)", 없으면 "방문자 177, 블로그 277"
    if data["rating"] and data["visitor_reviews"]:
        rating_line = f"{data['rating']}점 (방문자 리뷰 {data['visitor_reviews']}, 블로그 리뷰 {data['blog_reviews']})"
    elif data["visitor_reviews"]:
        rating_line = f"방문자 리뷰 {data['visitor_reviews']}, 블로그 리뷰 {data['blog_reviews']} (별점 미집계)"
    else:
        rating_line = "(추출 실패)"

    menu_line = "(추출 실패)"
    if data["menu_items"]:
        menu_line = "\n  - " + "\n  - ".join(data["menu_items"])

    lines = [
        f"- 업체명: {or_missing(data['name'])}",
        f"- 카테고리: {or_missing(data['category'])}",
        f"- 주소: {or_missing(data['address'])}",
        f"- 전화: {or_missing(data['phone'])}",
        f"- 영업시간: {or_missing(data['hours'])}",
        f"- 홈페이지: {or_missing(data['homepage'])}",
        f"- 편의시설: {or_missing(data['amenities'])}",
        f"- 별점/리뷰: {rating_line}",
        f"- AI 브리핑(리뷰 요약): {or_missing(data['description'])}",
        f"- 메뉴: {menu_line}",
    ]
    return "\n".join(lines)


def render_markdown(data: dict[str, Any], sections: list[dict[str, Any]]) -> str:
    place_block = format_place_data_block(data)
    raw_excerpt = data["raw_text"] or "(원문 추출 실패)"

    parts: list[str] = []
    parts.append("# 플레이스 SEO 최적화 작업지")
    parts.append("")
    parts.append(f"- 원본 URL: {data['input_url']}")
    parts.append(f"- Place ID: {data['place_id']}")
    parts.append(f"- 스크래핑 URL: {data['scraped_url']}")
    if data["errors"]:
        parts.append("")
        parts.append("## 스크래핑 오류")
        for e in data["errors"]:
            parts.append(f"- {e}")
    parts.append("")
    parts.append("## 추출된 현재 정보")
    parts.append("")
    parts.append(place_block)
    parts.append("")
    parts.append("---")
    parts.append("")
    parts.append("# 섹션별 최적화 작업")
    parts.append("")
    parts.append(
        "각 섹션의 프롬프트 블록을 복사하여 Antigravity / Claude 채팅창에 붙여넣으세요. "
        "받은 결과를 '결과' 영역에 기록하고, 그대로 네이버 플레이스에 붙여넣으면 됩니다."
    )
    parts.append("")

    if not sections:
        parts.append("> sections/ 폴더에 YAML 파일이 없습니다. 먼저 섹션 템플릿을 추가해주세요.")
    else:
        for i, sec in enumerate(sections, 1):
            name = sec.get("name", f"섹션 {i}")
            desc = sec.get("description", "")
            guide = sec.get("guide", "")
            prompt_tmpl = sec.get("prompt", "")

            prompt_filled = prompt_tmpl.replace("{place_data}", place_block).replace(
                "{raw_excerpt}", raw_excerpt
            )

            parts.append(f"## 섹션 {i}: {name}")
            parts.append("")
            if desc:
                parts.append(f"> {desc}")
                parts.append("")
            if guide:
                parts.append("### 작성 가이드")
                parts.append("")
                parts.append(guide.strip())
                parts.append("")
            parts.append("### 프롬프트 (복사해서 사용)")
            parts.append("")
            parts.append("````")
            parts.append(prompt_filled.strip())
            parts.append("````")
            parts.append("")
            parts.append("### 결과 (작업 후 이곳에 기록)")
            parts.append("")
            parts.append("_(여기에 붙여넣기)_")
            parts.append("")
            parts.append("---")
            parts.append("")

    return "\n".join(parts)


# ----------------------------------------------------------------------------
# 6. 진입점
# ----------------------------------------------------------------------------


async def amain() -> int:
    if len(sys.argv) < 2:
        print("사용법: uv run main.py <네이버 플레이스 URL>")
        return 1

    url = sys.argv[1]
    root = Path(__file__).parent

    print(f"[1/3] 스크래핑 시작: {url}")
    try:
        data = await scrape_place(url)
    except ValueError as exc:
        print(f"오류: {exc}")
        return 1

    # 추출 요약 로그
    extracted_count = sum(
        1
        for k in ("name", "category", "address", "phone", "hours", "homepage",
                  "amenities", "rating", "description")
        if data.get(k)
    )
    menu_count = len(data.get("menu_items") or [])
    print(f"      추출 필드 {extracted_count}/9, 메뉴 {menu_count}개")
    if data["name"]:
        print(f"      업체명: {data['name']}")

    print("[2/3] 섹션 템플릿 로드 중...")
    sections = load_sections(root / "sections")
    print(f"      {len(sections)}개 섹션 발견")

    print("[3/3] 작업지 생성 중...")
    md = render_markdown(data, sections)
    output_dir = root / "output"
    output_dir.mkdir(exist_ok=True)
    output_file = output_dir / f"{data['place_id']}.md"
    output_file.write_text(md, encoding="utf-8")

    print()
    print(f"완료. 결과 파일: {output_file}")
    return 0


def main() -> None:
    sys.exit(asyncio.run(amain()))


if __name__ == "__main__":
    main()
