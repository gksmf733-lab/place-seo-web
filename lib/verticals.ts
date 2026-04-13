/**
 * 네이버 플레이스 카테고리 문자열 → 버티컬(업종 분류) 자동 감지 + 라벨 맵.
 *
 * 카테고리 예시:
 *   - "카페,디저트"
 *   - "한식 > 삼겹살, 갈비"
 *   - "네일샵"
 *   - "내과의원"
 *   - "필라테스"
 */

export type Vertical =
  | "food"
  | "beauty"
  | "medical"
  | "lodging"
  | "education"
  | "fitness"
  | "other";

export type VerticalConfig = {
  key: Vertical;
  label: string;
  emoji: string;
  color: string; // CSS color
  bgColor: string;
  /** 메뉴 섹션 헤딩 라벨 */
  itemsLabel: string;
  /** 메뉴 항목 단위 명사 (예: "메뉴" / "시술" / "객실") */
  itemUnit: string;
  /** 부가서비스 정찰의 "예약" 라벨 오버라이드 */
  bookingLabel: string;
};

export const VERTICAL_CONFIG: Record<Vertical, VerticalConfig> = {
  food: {
    key: "food",
    label: "식음",
    emoji: "🍽",
    color: "#03C75A",
    bgColor: "#E8F7EE",
    itemsLabel: "메뉴",
    itemUnit: "메뉴",
    bookingLabel: "식사 예약",
  },
  beauty: {
    key: "beauty",
    label: "뷰티",
    emoji: "💅",
    color: "#E91E63",
    bgColor: "#FCE4EC",
    itemsLabel: "시술 메뉴",
    itemUnit: "시술",
    bookingLabel: "시술 예약",
  },
  medical: {
    key: "medical",
    label: "의료",
    emoji: "🏥",
    color: "#1E6BFA",
    bgColor: "#E3F2FD",
    itemsLabel: "진료/시술 항목",
    itemUnit: "진료 항목",
    bookingLabel: "진료 예약",
  },
  lodging: {
    key: "lodging",
    label: "숙박",
    emoji: "🏨",
    color: "#9C27B0",
    bgColor: "#F3E5F5",
    itemsLabel: "객실",
    itemUnit: "객실",
    bookingLabel: "객실 예약",
  },
  education: {
    key: "education",
    label: "교육",
    emoji: "📚",
    color: "#FF9800",
    bgColor: "#FFF3E0",
    itemsLabel: "강좌/과정",
    itemUnit: "강좌",
    bookingLabel: "상담 예약",
  },
  fitness: {
    key: "fitness",
    label: "피트니스",
    emoji: "💪",
    color: "#00BCD4",
    bgColor: "#E0F7FA",
    itemsLabel: "프로그램",
    itemUnit: "프로그램",
    bookingLabel: "수업 예약",
  },
  other: {
    key: "other",
    label: "기타",
    emoji: "🏪",
    color: "#767676",
    bgColor: "#F1F3F5",
    itemsLabel: "메뉴/상품",
    itemUnit: "항목",
    bookingLabel: "예약",
  },
};

/**
 * 카테고리 문자열 키워드 매칭 — 우선순위 높은 것부터.
 * 한 문자열에 여러 키워드가 매칭되면 첫 매칭이 승리.
 */
const VERTICAL_KEYWORDS: ReadonlyArray<{ vertical: Vertical; keywords: string[] }> = [
  {
    vertical: "medical",
    keywords: [
      "병원", "의원", "한의원", "치과", "약국", "성형외과", "피부과", "안과", "내과",
      "외과", "정형외과", "이비인후과", "산부인과", "소아과", "비뇨기과", "정신과",
      "마취통증", "재활의학", "한방",
    ],
  },
  {
    vertical: "beauty",
    keywords: [
      "네일", "속눈썹", "왁싱", "타투", "메이크업", "헤어샵", "헤어살롱", "미용실",
      "미용원", "바버샵", "피부관리", "에스테틱", "스킨케어", "마사지", "스파",
      "두피", "뷰티", "리프팅", "반영구",
    ],
  },
  {
    vertical: "fitness",
    keywords: [
      "필라테스", "요가", "헬스", "헬스장", "피트니스", "크로스핏", "복싱", "주짓수",
      "태권도", "검도", "수영", "골프연습장", "스크린골프", "탁구장", "볼링장",
      "스쿼시", "클라이밍", "스피닝", "PT", "체육관", "댄스",
    ],
  },
  {
    vertical: "lodging",
    keywords: [
      "호텔", "모텔", "펜션", "게스트하우스", "리조트", "민박", "한옥",
      "캠핑", "글램핑", "콘도", "숙박",
    ],
  },
  {
    vertical: "education",
    keywords: [
      "학원", "교습소", "공부방", "독서실", "스터디카페", "어학원", "유치원",
      "어린이집", "방과후", "과외", "교육원", "아카데미",
    ],
  },
  {
    vertical: "food",
    keywords: [
      "음식점", "식당", "한식", "일식", "중식", "양식", "분식", "치킨", "피자",
      "햄버거", "고기", "갈비", "삼겹살", "곱창", "족발", "보쌈", "회", "초밥",
      "라멘", "우동", "파스타", "스테이크", "뷔페", "베이커리", "빵집", "디저트",
      "카페", "커피", "브런치", "주점", "포차", "술집", "이자카야", "와인바",
      "맥주", "막걸리", "전통주", "퓨전", "아시안", "베트남", "태국",
    ],
  },
];

/** 카테고리 문자열에서 버티컬을 자동 감지. 매칭 없으면 "other" */
export function detectVertical(category: string | null | undefined): Vertical {
  if (!category) return "other";
  const lower = category.toLowerCase();
  for (const { vertical, keywords } of VERTICAL_KEYWORDS) {
    for (const kw of keywords) {
      if (lower.includes(kw.toLowerCase())) {
        return vertical;
      }
    }
  }
  return "other";
}

export function getVerticalConfig(category: string | null | undefined): VerticalConfig {
  return VERTICAL_CONFIG[detectVertical(category)];
}
