import { generateText } from "ai";

import { buildAnalysisContext } from "./review-intro";
import type { OwnerIntro, ReviewAnalysis } from "./jobs";

const MODEL_ID = "anthropic/claude-sonnet-4.6";

/**
 * "본인 매장에 자신있는 사장님" 1인칭 시점 업체 소개글 생성.
 * - 어투: ~어요 / ~입니다 혼용 (랜덤)
 * - 리뷰·분석 컨텍스트는 buildAnalysisContext()로 자동 주입
 */
export async function generateOwnerIntro(params: {
  placeName: string;
  category: string;
  analysis: ReviewAnalysis;
  reviews: unknown[];
  guide?: string;
}): Promise<OwnerIntro> {
  const context = buildAnalysisContext({
    placeName: params.placeName,
    category: params.category,
    analysis: params.analysis,
    reviews: params.reviews,
  });

  const system = `당신은 "${params.placeName}"의 사장님입니다.
본인의 가게에 큰 자부심과 애정을 가진 사장님의 1인칭 시점으로, 실제 리뷰와 분석 결과를 바탕으로 손님들께 매장을 소개하는 글을 씁니다.

[어투 규칙 — 반드시 지킬 것]
- 문장 종결은 "~어요/~아요" 체와 "~입니다" 체를 자연스럽게 **랜덤으로 혼용**합니다.
- 한 문단 안에서도 두 어미가 섞여 있어야 합니다.
- 딱딱한 존댓말("~합니다만", "~하오니") 금지, 과하게 귀여운 말투("~용", "~당") 금지.
- 이모지·해시태그·머리말·제목 금지. 본문만 출력.

[톤]
- 본인 매장에 자신있는 사장님답게 당당하고 따뜻한 어조.
- "저희 가게", "제가", "우리 집"처럼 1인칭을 자연스럽게 사용.
- 자랑하되 허세 없이, 리뷰에 실제로 드러난 강점만 근거로 합니다.
- 과장·추측·허위 정보 금지.

[내용 구성]
- 분량: 공백 포함 **최소 500자, 최대 1000자** 이내. 이 범위를 반드시 지켜야 합니다.
- 리뷰 분석에서 반복적으로 드러난 강점(분위기·시그니처 메뉴·서비스·공간)을 자연스럽게 3~5가지 엮어 소개.
- 주요 고객 페르소나가 어떤 가치를 느끼는지 1인칭 사장님의 시선에서 언급.
- 마지막은 손님을 맞이하는 진심 어린 한 문장으로 마무리.`;

  const userGuide = params.guide?.trim();
  const systemWithGuide = userGuide
    ? `${system}\n\n[관리자 추가 가이드 — 위 규칙과 충돌하지 않는 한 반드시 반영]\n${userGuide}`
    : system;

  const prompt = `${context}\n\n---\n위 리뷰와 분석 내용을 바탕으로, "${params.placeName}"의 사장님 1인칭 시점에서 업체 소개글을 작성하세요. 위의 [어투 규칙]을 반드시 지키세요. 본문만 출력하고 머리말/해시태그는 붙이지 마세요.`;

  const { text } = await generateText({
    model: MODEL_ID,
    system: systemWithGuide,
    prompt,
    temperature: 0.85,
  });

  return {
    text: text.trim(),
    guide: userGuide || undefined,
    generatedAt: new Date().toISOString(),
    model: MODEL_ID,
  };
}
