import { deleteJobs } from "@/lib/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const ids = body?.ids;

    if (!Array.isArray(ids) || ids.length === 0) {
      return Response.json(
        { error: "삭제할 항목의 ids 배열이 필요합니다." },
        { status: 400 },
      );
    }

    const deleted = await deleteJobs(ids);
    return Response.json({ ok: true, deleted });
  } catch (err) {
    console.error("[api/jobs DELETE] error:", err);
    return Response.json(
      {
        error: "삭제 중 오류 발생",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
