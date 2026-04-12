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
        .describe(
          "개선 필요 시 구체적 개선 방향. 불필요하면 빈 문자열",
        ),
    }),
  ),
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
        "\n[핵심 강점]",
        analysis.strengths.map((s) => `- ${s}`).join("\n"),
        "\n[개선 사항]",
        analysis.improvements.map((s) => `- ${s}`).join("\n"),
      ].join("\n")
    : "";

  const system = `당신은 한국 네이버 플레이스의 메뉴별 고객 평가를 분석하는 전문가입니다.
- 한국어로 답하세요.
- 리뷰에 실제로 언급된 내용만 근거로 사용하세요.
- 리뷰에 해당 메뉴 언급이 전혀 없으면 strengths=[], weaknesses=[], needsImprovement=false, improvementSuggestion="" 으로 비워두세요.
- 강점/단점 각 항목은 1문장, 구체적으로 (예: "크림이 진해서 달지 않고 풍미가 좋다는 평이 많음").
- needsImprovement는 동일 단점이 2건 이상 반복될 때만 true.
- improvementSuggestion은 needsImprovement=true일 때만 구체적으로 작성.`;

  const prompt = `[업체명] ${placeName}

[평가 대상 메뉴 목록]
${menuList}
${analysisBlock}

[원본 리뷰 (${reviews.length}건 중 최대 ${MAX_REVIEWS}건)]
${corpus}

위 리뷰를 바탕으로, 각 메뉴별 고객 평가를 분석해 JSON으로 출력하세요.
리뷰에서 해당 메뉴가 언급되지 않은 경우 빈 배열과 false로 처리하세요.`;

  const { output } = await generateText({
    model: MODEL_ID,
    output: Output.object({ schema: menuEvalSchema }),
    system,
    prompt,
    temperature: 0.3,
  });

  return {
    items: output.items,
    meta: {
      analyzedAt: new Date().toISOString(),
      model: MODEL_ID,
      menuCount: menuNames.length,
      reviewCount: reviews.length,
    },
  };
}
