import { updateJob, listJobs } from "@/lib/jobs";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let rawBody = "";
  try {
    rawBody = await req.text(); // 스트림을 텍스트로 전부 읽음
    const body = JSON.parse(rawBody); // JSON 파싱 시도

    // AI Canvas 형식: { "placeId": "...", "reviews": [...] }
    const { placeId, reviews } = body;

    if (!placeId || !reviews) {
      return Response.json(
        { error: "placeId와 reviews 데이터가 필요합니다." },
        { status: 400 },
      );
    }

    // 파일 시스템 저장 코드를 제거하고 전체 Job 리스트를 DB에서 불러와 매칭되는 내역을 업데이트
    const jobs = await listJobs();
    const relatedJob = jobs.find(
      (j) => j.placeId === placeId || j.url.includes(placeId),
    );

    if (relatedJob) {
      await updateJob(relatedJob.id, { reviewsData: reviews });
      return Response.json({
        ok: true,
        message: "리뷰 데이터 DB 저장 완료",
      });
    }

    // 관련 Job을 찾지 못해도 리뷰 결과를 보존할 경우의 대안 처리 (현재는 404 리턴)
    return Response.json(
      { error: "제출된 placeId와 일치하는 주문 내역이 없습니다." },
      { status: 404 },
    );
  } catch (err) {
    console.error("[api/reviews] Error processing reviews:", err);
    return Response.json(
      { 
        error: "JSON 파싱 오류 발생. AI Canvas에서 보낸 포맷이 깨졌습니다.",
        receivedBody: rawBody,
        details: err instanceof Error ? err.message : String(err)
      }, 
      { status: 500 }
    );
  }
}
