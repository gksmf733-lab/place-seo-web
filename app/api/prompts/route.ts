import { createPrompt, listPrompts, type PromptInput } from "@/lib/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sectionType = url.searchParams.get("sectionType") ?? undefined;
  const prompts = await listPrompts(sectionType);
  return Response.json({ prompts });
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "잘못된 요청 형식입니다." },
      { status: 400 },
    );
  }

  if (typeof body !== "object" || body === null) {
    return Response.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }

  const b = body as Record<string, unknown>;

  if (!isNonEmptyString(b.sectionType)) {
    return Response.json(
      { error: "sectionType이 필요합니다." },
      { status: 400 },
    );
  }
  if (!isNonEmptyString(b.name)) {
    return Response.json({ error: "name이 필요합니다." }, { status: 400 });
  }
  if (!isNonEmptyString(b.promptTemplate)) {
    return Response.json(
      { error: "promptTemplate이 필요합니다." },
      { status: 400 },
    );
  }

  const input: PromptInput = {
    sectionType: b.sectionType.trim(),
    name: b.name.trim(),
    description: isNonEmptyString(b.description) ? b.description.trim() : "",
    guide: isNonEmptyString(b.guide) ? b.guide : "",
    promptTemplate: b.promptTemplate,
    isDefault: typeof b.isDefault === "boolean" ? b.isDefault : false,
    sortOrder: typeof b.sortOrder === "number" ? b.sortOrder : 0,
  };

  const created = await createPrompt(input);
  if (!created) {
    return Response.json(
      { error: "프롬프트 생성 실패" },
      { status: 500 },
    );
  }
  return Response.json({ ok: true, prompt: created });
}
