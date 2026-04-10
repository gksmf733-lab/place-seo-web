import { updateJob, listJobs } from "@/lib/jobs";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    // URL에서 placeId를 찾습니다 (예: ?placeId=12345)
    const url = new URL(req.url);
    let placeId = url.searchParams.get("placeId");

    // 만약 JSON 방식으로 보냈을 경우를 대비한 하위 호환성 (하지만 에러 날 수 있음)
    let rawBody = await req.text();
    let reviewsData: any = rawBody;

    try {
      // 1. JSON으로 보냈을 경우 시도
      const parsed = JSON.parse(rawBody);
      if (parsed.placeId) placeId = parsed.placeId;
      if (parsed.reviews) reviewsData = parsed.reviews;
    } catch {
      // 2. JSON이 아니거나 깨졌으면 그냥 넘어감 (rawBody 통째로 리뷰로 간주)
      // 이 경우 placeId는 주소창(?placeId=...)에 무조건 있어야 함
    }

    if (!placeId) {
      return Response.json(
        { error: "placeId가 필요합니다. 주소 끝에 ?placeId={{변수}} 를 붙여주세요." },
        { status: 400 },
      );
    }

    const jobs = await listJobs();
    const relatedJob = jobs.find(
      (j) => j.placeId === placeId || j.url.includes(placeId as string),
    );

    if (relatedJob) {
      await updateJob(relatedJob.id, { reviewsData: reviewsData });
      return Response.json({
        ok: true,
        message: "리뷰 데이터 DB 저장 완료",
      });
    }

    return Response.json(
      { error: "제출된 placeId와 일치하는 주문 내역이 없습니다." },
      { status: 404 },
    );
  } catch (err) {
    console.error("[api/reviews] Error processing reviews:", err);
    return Response.json(
      { error: "서버 처리 중 오류 발생", details: err instanceof Error ? err.message : String(err) }, 
      { status: 500 }
    );
  }
}

