import {
  deletePrompt,
  readPrompt,
  updatePrompt,
  type PromptInput,
} from "@/lib/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const prompt = await readPrompt(id);
  if (!prompt) {
    return Response.json({ error: "찾을 수 없습니다." }, { status: 404 });
  }
  return Response.json({ prompt });
}

export async function PUT(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
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
  const patch: Partial<PromptInput> = {};
  if (typeof b.sectionType === "string") patch.sectionType = b.sectionType.trim();
  if (typeof b.name === "string") patch.name = b.name.trim();
  if (typeof b.description === "string") patch.description = b.description;
  if (typeof b.guide === "string") patch.guide = b.guide;
  if (typeof b.promptTemplate === "string")
    patch.promptTemplate = b.promptTemplate;
  if (typeof b.isDefault === "boolean") patch.isDefault = b.isDefault;
  if (typeof b.sortOrder === "number") patch.sortOrder = b.sortOrder;

  const updated = await updatePrompt(id, patch);
  if (!updated) {
    return Response.json({ error: "업데이트 실패" }, { status: 500 });
  }
  return Response.json({ ok: true, prompt: updated });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const ok = await deletePrompt(id);
  if (!ok) {
    return Response.json({ error: "삭제 실패" }, { status: 500 });
  }
  return Response.json({ ok: true });
}
