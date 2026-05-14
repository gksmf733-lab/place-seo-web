import { generateText, Output } from "ai";
import { z } from "zod";
import type { ReviewAnalysis } from "./jobs";
import { resolvePrompt } from "./prompts";

const MODEL_ID = "anthropic/claude-sonnet-4.6";
const MAX_REVIEWS = 120;
const MAX_REVIEW_CHARS = 400;

const sentimentSchema = z.object({
  positive: z.number().min(0).max(100).describe("긍정 리뷰 비율(%)"),
  negative: z.number().min(0).max(100).describe("부정 리뷰 비율(%)"),
  neutral: z.number().min(0).max(100).describe("중립 리뷰 비율(%)"),
  score: z.number().min(-1).max(1).describe("종합 감성 점수(-1~1, 음수=부정)"),
  tone: z.string().describe("전반적인 리뷰 톤 요약 1문장"),
});

const keywordSchema = z.object({
  word: z.string().describe("키워드(2~6글자 한국어 명사/형용사)"),
  count: z.number().int().min(1).describe("등장 빈도 추정"),
  context: z.string().describe("이 키워드가 주로 쓰인 맥락 한 줄"),
});

const personaSchema = z.object({
  name: z.string().describe("페르소나 별명(예: '데이트 중인 20대 커플')"),
  ageRange: z.string().describe("추정 연령대"),
  visitPurpose: z.string().describe("방문 목적"),
  companions: z.string().describe("동반자 유형"),
  preferences: z.string().describe("선호하는 요소"),
  description: z.string().describe("이 페르소나에 대한 2-3문장 설명"),
});

const analysisSchema = z.object({
  summary: z.string().describe("전체 리뷰에 대한 종합요약 3-5문장"),
  sentiment: sentimentSchema,
  keywords: z
    .array(keywordSchema)
    .min(5)
    .max(20)
    .describe("리뷰에서 반복 등장하는 핵심 키워드"),
  strengths: z
    .array(z.string())
    .min(3)
    .max(8)
    .describe("업체의 핵심 강점(구체적 문장, 리뷰 근거 반영)"),
  improvements: z
    .array(z.string())
    .min(0)
    .max(8)
    .describe("개선 사항 참고(리뷰에서 언급된 불만/아쉬움)"),
  personas: z
    .array(personaSchema)
    .min(2)
    .max(4)
    .describe("매장의 대표 고객 페르소나"),
  goldenKeywords: z
    .array(z.string())
    .min(5)
    .max(15)
    .describe(
      "리뷰 속 황금 키워드: SEO·마케팅에 즉시 활용 가능한, 감정·상황·차별점이 녹아있는 고부가 키워드",
    ),
});

export type ReviewAnalysisGenerated = z.infer<typeof analysisSchema>;

function extractText(item: unknown): string {
  if (item == null) return "";
  if (typeof item === "string") return item;
  if (typeof item === "object") {
    const o = item as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof o.review === "string") parts.push(o.review);
    if (typeof o.keywords === "string") parts.push(`[키워드: ${o.keywords}]`);
    if (typeof o.visitedAt === "string") parts.push(`(방문 ${o.visitedAt})`);
    return parts.join(" ");
  }
  return String(item);
}

function buildReviewCorpus(rawReviews: unknown[]): {
  corpus: string;
  used: number;
} {
  const texts: string[] = [];
  for (const r of rawReviews) {
    const t = extractText(r).trim();
    if (!t) continue;
    const truncated =
      t.length > MAX_REVIEW_CHARS ? t.slice(0, MAX_REVIEW_CHARS) + "…" : t;
    texts.push(`- ${truncated}`);
    if (texts.length >= MAX_REVIEWS) break;
  }
  return { corpus: texts.join("\n"), used: texts.length };
}

export async function analyzeReviews(params: {
  placeName: string;
  category?: string;
  reviews: unknown[];
  promptId?: string; // 어드민에서 선택된 분석 지침 (없으면 review_analysis 섹션의 default)
}): Promise<ReviewAnalysis> {
  const { placeName, category, reviews, promptId } = params;
  if (!reviews || reviews.length === 0) {
    throw new Error("분석할 리뷰가 없습니다.");
  }

  const { corpus, used } = buildReviewCorpus(reviews);
  if (used === 0) {
    throw new Error("리뷰 텍스트를 추출할 수 없습니다.");
  }

  const baseSystem = `당신은 한국 네이버 플레이스 리뷰를 분석하는 마케팅/SEO 전문가입니다.
업체의 고객 리뷰를 분석해 종합요약, 감성, 키워드, 강점, 개선사항, 고객 페르소나, 황금 키워드를 추출합니다.
- 한국어로 답하세요.
- 과장·추측 대신 리뷰에서 반복적으로 드러나는 패턴만 사용하세요.
- '황금 키워드'는 단순 빈출어가 아니라 구매 전환·검색 유입에 기여할 만한 감정·상황·차별점 결합 구문을 뽑으세요.
- 페르소나는 서로 뚜렷이 구분되어야 합니다.`;

  // 사용자 지정 분석 지침 (DB prompts 테이블의 review_analysis 섹션 default 또는 promptId)
  // 출력은 기존 JSON 스키마로 강제되지만, 지침의 톤·원칙(가짜 데이터 금지, 근거 명시,
  // 실제 인용만 사용 등)이 system prompt 에 추가돼 결과 품질이 보강된다.
  const customPrompt = await resolvePrompt("review_analysis", promptId).catch(
    () => null,
  );
  const system = customPrompt?.promptTemplate
    ? `${baseSystem}

[추가 분석 지침 — ${customPrompt.name}]
${customPrompt.promptTemplate}

[중요] 위 추가 지침의 톤·원칙·표현 기준을 따르되, 최종 출력은 반드시 지정된 JSON 스키마(summary / sentiment / keywords / strengths / improvements / personas / goldenKeywords) 안에서 표현하세요. 스키마에 없는 새 필드를 만들거나 형식을 바꾸지 마세요.`
    : baseSystem;

  const prompt = `[업체명] ${placeName}
[카테고리] ${category ?? "(미상)"}
[분석 대상 리뷰 수] ${used}건 (전체 ${reviews.length}건 중 샘플)

[리뷰 목록]
${corpus}

위 리뷰들을 바탕으로 지정된 JSON 스키마에 맞춰 분석 결과를 생성하세요.`;

  const { output } = await generateText({
    model: MODEL_ID,
    output: Output.object({ schema: analysisSchema }),
    system,
    prompt,
    temperature: 0.3,
  });

  return {
    ...output,
    meta: {
      analyzedAt: new Date().toISOString(),
      model: MODEL_ID,
      reviewCount: used,
      promptId: customPrompt?.id,
      promptName: customPrompt?.name,
    },
  };
}
