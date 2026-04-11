import { readJob } from "@/lib/jobs";
import { processJob } from "@/lib/pipeline";

// Playwright 실행 필요 — Node 런타임 + 긴 타임아웃
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const job = await readJob(id);
    if (!job) {
      return Response.json(
        { error: "job을 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    // 동기적으로 실행 — 사용자가 결과까지 기다림
    await processJob(job);
    const updated = await readJob(id);

    return Response.json({ ok: true, job: updated });
  } catch (err) {
    console.error("[/api/scrape/[id]] failed", err);
    const message = err instanceof Error ? err.message : "재스크래핑 실패";
    return Response.json({ error: message }, { status: 500 });
  }
}
