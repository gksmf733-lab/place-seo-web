export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CRAWLER_URL =
  process.env.REVIEW_CRAWLER_URL || "http://localhost:3003";

/** GET: 현재 IP 조회 */
export async function GET() {
  try {
    const res = await fetch(`${CRAWLER_URL}/api/ip`, {
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();
    return Response.json(data);
  } catch {
    return Response.json({ success: false, ip: null, error: "크롤러 연결 실패" });
  }
}

/** POST: IP 수동 변경 */
export async function POST() {
  try {
    const res = await fetch(`${CRAWLER_URL}/api/rotate-ip`, {
      method: "POST",
      signal: AbortSignal.timeout(30000),
    });
    const data = await res.json();
    return Response.json(data);
  } catch {
    return Response.json({ success: false, error: "IP 변경 요청 실패" });
  }
}
