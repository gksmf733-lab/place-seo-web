import { probePlace } from "@/lib/probe";
import { listJobs, updateJob } from "@/lib/jobs";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ placeId: string }> },
) {
  const { placeId } = await params;
  if (!placeId || !/^\d+$/.test(placeId)) {
    return Response.json({ error: "유효하지 않은 placeId" }, { status: 400 });
  }

  try {
    const result = await probePlace(placeId);

    // placeId로 매칭되는 job에 결과 저장
    const jobs = await listJobs();
    const matched = jobs.find(
      (j) => j.placeId === placeId || j.url?.includes(placeId),
    );
    if (matched) {
      await updateJob(matched.id, { probeData: result });
    }

    return Response.json({ ok: true, data: result });
  } catch (err) {
    console.error("[/api/probe] failed", err);
    const message = err instanceof Error ? err.message : "정찰 실패";
    return Response.json({ error: message }, { status: 500 });
  }
}
