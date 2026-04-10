export const PLACE_ID_PATTERN = /\/place\/(\d+)/;
export const RAW_EXCERPT_LIMIT = 2000;

// UI 노이즈 라벨 (Python NOISE_LINES 포팅)
export const NOISE_LINES: ReadonlySet<string> = new Set([
  "이전 페이지", "마이플레이스", "알림받기", "저장", "길찾기", "공유", "예약",
  "홈", "소식", "메뉴", "리뷰", "사진", "지도", "주변", "정보", "쿠폰",
  "전화", "문의", "안내", "복사", "인스타그램", "홈페이지", "편의", "내부",
  "외부", "음식·음료", "메뉴판", "알림", "다운로드", "이미지 갯수", "별점",
  "찾아가는길", "내용 더보기", "영업시간", "펼쳐보기", "전화번호", "주소",
  "더보기", "AI 브리핑", "실험 단계로 정확하지 않을 수 있어요.",
  "이용약관고객센터리뷰운영정책신고센터", "네이버", "카테고리", "999+",
  "메뉴판 이미지로 보기", "영업 종료", "영업 중", "가격표", "가격표 이미지로 보기",
]);

export const NOISE_PATTERNS: readonly RegExp[] = [
  /^\d+$/,                              // 1, 2, 3 (리뷰 인덱스)
  /^\d{2}\.\d{2}\.\d{2}\.?$/,           // 25.07.31.
  /^\d{4}년 \d{1,2}월 \d{1,2}일/,        // 2025년 07월 31일
  /^메뉴\d*$/,                          // 메뉴20
];

export const TIME_PATTERN = /\d{1,2}:\d{2}/;
export const KOREAN_TIME_PATTERN = /\d{1,2}시\s*\d{1,2}분/;
export const PHONE_PATTERN = /^[\d][\d\-]{7,}/;
export const PRICE_PATTERN = /^[\d,]+원$/;
export const RATING_PATTERN =
  /^(?:(\d\.\d+))?방문자 리뷰\s*([\d,]+).*?블로그 리뷰\s*([\d,]+)/;
export const CLOSED_DAY_PATTERN = /매주\s*[월화수목금토일]요일\s*휴무/;
export const URL_PATTERN = /https?:\/\/[^\s]+/;

export const MENU_BADGES: ReadonlySet<string> = new Set([
  "대표", "추천", "NEW", "인기", "신규", "BEST", "베스트",
]);
export const MENU_NAME_HARD_CAP = 35;
export const MENU_NAME_EXCLUDE = [
  "쿠폰", "주소", "리뷰", "블로그", "이미지로 보기", "가격표", "사진",
] as const;
