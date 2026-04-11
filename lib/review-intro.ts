import { generateText } from "ai";

import type { ReviewAnalysis, ReviewIntro } from "./jobs";

const MODEL_ID = "anthropic/claude-sonnet-4.6";
const MAX_REVIEWS = 60;
const MAX_REVIEW_CHARS = 300;

function extractReviewText(item: unknown): string {
  if (item == null) return "";
  if (typeof item === "string") return item;
  if (typeof item === "object") {
    const o = item as Record<string, unknown>;
    if (typeof o.review === "string") return o.review;
    if (typeof o.text === "string") return o.text;
  }
  return "";
}

function buildReviewCorpus(rawReviews: unknown[]): string {
  const out: string[] = [];
  for (const r of rawReviews) {
    const t = extractReviewText(r).trim();
    if (!t) continue;
    const truncated =
      t.length > MAX_REVIEW_CHARS ? t.slice(0, MAX_REVIEW_CHARS) + "…" : t;
    out.push(`- ${truncated}`);
    if (out.length >= MAX_REVIEWS) break;
  }
  return out.join("\n");
}

function formatStrengths(strengths: string[]): string {
  return strengths.map((s) => `- ${s}`).join("\n");
}

function formatKeywords(keywords: ReviewAnalysis["keywords"]): string {
  return keywords
    .map((k) => `- ${k.word} (×${k.count}) — ${k.context}`)
    .join("\n");
}

function formatGoldenKeywords(golden: string[]): string {
  return golden.map((g) => `- ${g}`).join("\n");
}

function formatPersonas(personas: ReviewAnalysis["personas"]): string {
  return personas
    .map(
      (p) =>
        `• ${p.name} (${p.ageRange})\n  방문 목적: ${p.visitPurpose}\n  동반자: ${p.companions}\n  선호: ${p.preferences}\n  설명: ${p.description}`,
    )
    .join("\n\n");
}

/**
 * 리뷰 분석 결과와 원본 리뷰를 구조화된 컨텍스트 블록으로 조립한다.
 * 사용자가 작성한 가이드(= guide 텍스트)는 이 컨텍스트 뒤에 그대로 붙는다.
 */
export function buildAnalysisContext(params: {
  placeName: string;
  category: string;
  analysis: ReviewAnalysis;
  reviews: unknown[];
}): string {
  const { placeName, category, analysis, reviews } = params;
  return [
    `[업체명] ${placeName}`,
    `[카테고리] ${category || "(미상)"}`,
    "",
    "[리뷰 종합 요약]",
    analysis.summary,
    "",
    "[업체 핵심 강점]",
    formatStrengths(analysis.strengths),
    "",
    "[키워드 분석]",
    formatKeywords(analysis.keywords),
    "",
    "[황금 키워드]",
    formatGoldenKeywords(analysis.goldenKeywords),
    "",
    "[고객 페르소나]",
    formatPersonas(analysis.personas),
    "",
    "[원본 리뷰 샘플]",
    buildReviewCorpus(reviews),
  ].join("\n");
}

export async function generateReviewIntro(params: {
  guide: string;
  promptId: string;
  promptName: string;
  placeName: string;
  category: string;
  analysis: ReviewAnalysis;
  reviews: unknown[];
}): Promise<ReviewIntro> {
  const context = buildAnalysisContext({
    placeName: params.placeName,
    category: params.category,
    analysis: params.analysis,
    reviews: params.reviews,
  });

  const guideText = params.guide.trim() || "자연스럽고 구체적인 톤으로 작성해 주세요.";

  const prompt = `${context}\n\n---\n[작성 가이드]\n${guideText}\n\n위 리뷰 분석 자료와 작성 가이드를 바탕으로 네이버 플레이스에 노출될 "업체 소개글"을 작성하세요. 본문만 출력하고 머리말/해시태그는 붙이지 마세요.`;

  const system = `당신은 한국 네이버 플레이스 업체 소개글을 작성하는 카피라이터입니다.
- 한국어로 작성하세요.
- 리뷰에 근거하지 않은 과장·추측·허위 정보는 금지합니다.
- 작성 가이드의 톤·스타일 지시를 따르되, 아래 분량 규칙은 **반드시** 우선합니다.
- [분량 규칙] 본문은 공백 포함 **최소 500자, 최대 1000자** 이내로 작성합니다. 이 범위를 벗어나면 안 됩니다.
- 응답은 소개글 본문만 출력하고 머리말/설명/해시태그는 제외하세요.`;

  const { text } = await generateText({
    model: MODEL_ID,
    system,
    prompt,
    temperature: 0.7,
  });

  return {
    text: text.trim(),
    promptId: params.promptId,
    promptName: params.promptName,
    generatedAt: new Date().toISOString(),
    model: MODEL_ID,
  };
}
