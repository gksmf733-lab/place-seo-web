import { generateText, Output } from "ai";
import { z } from "zod";

import type { MenuEvaluation, ReviewAnalysis } from "./jobs";

const MODEL_ID = "anthropic/claude-sonnet-4.6";
const MAX_REVIEWS = 100;
const MAX_REVIEW_CHARS = 400;

function extractText(item: unknown): string {
  if (item == null) return "";
  if (typeof item === "string") return item;
  if (typeof item === "object") {
    const o = item as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof o.review === "string") parts.push(o.review);
    if (typeof o.keywords === "string") parts.push(`[키워드: ${o.keywords}]`);
    return parts.join(" ");
  }
  return "";
}

function buildCorpus(reviews: unknown[]): string {
  const out: string[] = [];
  for (const r of reviews) {
    const t = extractText(r).trim();
    if (!t) continue;
    out.push(
      `- ${t.length > MAX_REVIEW_CHARS ? t.slice(0, MAX_REVIEW_CHARS) + "…" : t}`,
    );
    if (out.length >= MAX_REVIEWS) break;
  }
  return out.join("\n");
}

const menuEvalSchema = z.object({
  items: z.array(
    z.object({
      menu: z.string().describe("메뉴명 (입력된 그대로)"),
      strengths: z
        .array(z.string())
        .min(0)
        .max(5)
        .describe("고객이 뽑은 강점 (리뷰 근거)"),
      weaknesses: z
        .array(z.string())
        .min(0)
        .max(5)
        .describe("고객이 지적한 단점 (리뷰 근거)"),
      needsImprovement: z
        .boolean()
        .describe("개선이 필요한지 여부 (단점이 반복적이면 true)"),
      improvementSuggestion: z
        .string()
        .describe("개선 필요 시 구체적 개선 방향. 불필요하면 빈 문자열"),
      reviewSummary: z
        .string()
        .describe(
          "이 메뉴에 대한 리뷰 종합분석 1~2문장. 리뷰 언급이 없으면 '리뷰 언급 없음'",
        ),
    }),
  ),
  overall: z.object({
    totalRating: z
      .string()
      .describe("업체 전체 평점 (예: '4.84')"),
    totalReviewCount: z
      .number()
      .describe("총 리뷰 수"),
    commonKeywords: z
      .array(z.string())
      .min(3)
      .max(10)
      .describe("메뉴별 리뷰에서 도출된 공통 키워드 및 특징"),
    bestMenu: z.string().describe("가장 호평받은 메뉴명"),
    bestMenuReason: z
      .string()
      .describe("호평 이유 1문장"),
    worstMenu: z.string().describe("가장 아쉬운 메뉴명"),
    worstMenuReason: z
      .string()
      .describe("아쉬운 이유 1문장"),
    expertComment: z
      .string()
      .describe(
        "종합 평가 코멘트. 전문 음식 평론가 스타일, 격식체(~이라 할 수 있다, ~이 돋보인다), 맛·구성·가성비·메뉴 다양성을 다각도로 평가, 3~5문장.",
      ),
  }),
});

export async function evaluateMenus(params: {
  placeName: string;
  menuNames: string[];
  reviews: unknown[];
  analysis?: ReviewAnalysis | null;
}): Promise<MenuEvaluation> {
  const { placeName, menuNames, reviews, analysis } = params;

  const corpus = buildCorpus(reviews);
  const menuList = menuNames.map((m, i) => `${i + 1}. ${m}`).join("\n");

  const analysisBlock = analysis
    ? [
        "\n[리뷰 종합 요약]",
        analysis.summary,
        `\n[별점] ${analysis.sentiment?.score != null ? (((analysis.sentiment.score + 1) / 2) * 5).toFixed(2) : "불명"}`,
        "\n[핵심 강점]",
        analysis.strengths.map((s) => `- ${s}`).join("\n"),
        "\n[개선 사항]",
        analysis.improvements.map((s) => `- ${s}`).join("\n"),
        "\n[황금 키워드]",
        analysis.goldenKeywords?.join(", ") ?? "",
      ].join("\n")
    : "";

  const system = `당신은 한국 네이버 플레이스의 메뉴별 고객 평가를 분석하는 전문가이자, 격식체를 구사하는 전문 음식 평론가입니다.

[메뉴별 분석 규칙]
- 한국어로 답하세요.
- 리뷰에 실제로 언급된 내용만 근거로 사용하세요.
- 리뷰에 해당 메뉴 언급이 전혀 없으면 strengths=[], weaknesses=[], needsImprovement=false, improvementSuggestion="", reviewSummary="리뷰 언급 없음".
- 강점/단점 각 항목은 1문장, 구체적으로.
- needsImprovement는 동일 단점이 2건 이상 반복될 때만 true.
- improvementSuggestion은 needsImprovement=true일 때만 구체적으로 작성.
- reviewSummary는 해당 메뉴에 대한 고객 의견을 1~2문장으로 종합.

[종합 분석(overall) 규칙]
- totalRating: 리뷰 분석에서 제공된 평점 정보를 그대로 사용.
- totalReviewCount: 분석에 사용된 리뷰 수.
- commonKeywords: 메뉴별 리뷰에서 반복 등장하는 공통 키워드·특징.
- bestMenu/worstMenu: 리뷰 반응이 가장 좋은/아쉬운 메뉴. 리뷰가 없는 메뉴는 제외.
- expertComment: 전문 음식 평론가 스타일, 격식체("~이라 할 수 있다", "~이 돋보인다"), 맛·구성·가성비·메뉴 다양성을 다각도로 평가, 3~5문장의 품격 있는 문장.`;

  const prompt = `[업체명] ${placeName}

[평가 대상 메뉴 목록]
${menuList}
${analysisBlock}

[원본 리뷰 (${reviews.length}건 중 최대 ${MAX_REVIEWS}건)]
${corpus}

위 리뷰를 바탕으로, 각 메뉴별 고객 평가와 종합 분석을 JSON으로 출력하세요.`;

  const { output } = await generateText({
    model: MODEL_ID,
    output: Output.object({ schema: menuEvalSchema }),
    system,
    prompt,
    temperature: 0.3,
  });

  return {
    items: output.items,
    overall: output.overall,
    meta: {
      analyzedAt: new Date().toISOString(),
      model: MODEL_ID,
      menuCount: menuNames.length,
      reviewCount: reviews.length,
    },
  };
}
