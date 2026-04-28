import crypto from "node:crypto";
import { readJob, updateJob, listJobs } from "@/lib/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map(stableStringify).join(",") + "]";
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return (
    "{" +
    keys
      .map(
        (k) =>
          JSON.stringify(k) +
          ":" +
          stableStringify((value as Record<string, unknown>)[k]),
      )
      .join(",") +
    "}"
  );
}

function contentHash(item: unknown): string {
  return crypto
    .createHash("sha1")
    .update(stableStringify(item))
    .digest("hex");
}

function toArray(v: unknown): unknown[] {
  if (v == null) return [];
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed;
      return [parsed];
    } catch {
      return [v];
    }
  }
  return [v];
}

async function findJobByPlaceId(placeId: string) {
  const jobs = await listJobs();
  return jobs.find(
    (j) => j.placeId === placeId || j.url.includes(placeId),
  );
}

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    let placeId = url.searchParams.get("placeId");

    const rawBody = await req.text();
    let incoming: unknown;
    try {
      incoming = JSON.parse(rawBody);
    } catch {
      incoming = { review: rawBody };
    }

    // {placeId, reviews} 래퍼 지원
    if (
      incoming &&
      typeof incoming === "object" &&
      !Array.isArray(incoming)
    ) {
      const obj = incoming as Record<string, unknown>;
      if (!placeId && typeof obj.placeId === "string") {
        placeId = obj.placeId;
      }
      if (obj.reviews !== undefined) {
        incoming = obj.reviews;
      }
    }

    if (!placeId) {
      return Response.json(
        {
          error:
            "placeId가 필요합니다. 쿼리 파라미터(?placeId=...) 또는 body.placeId로 전달하세요.",
        },
        { status: 400 },
      );
    }

    const relatedJob = await findJobByPlaceId(placeId);
    if (!relatedJob) {
      return Response.json(
        { error: "제출된 placeId와 일치하는 주문 내역이 없습니다." },
        { status: 404 },
      );
    }

    const fullJob = await readJob(relatedJob.id);
    const rawExisting = toArray(fullJob?.reviewsData);
    const incomingItems = toArray(incoming);

    // 기존 배열에 과거 누적된 중복이 있으면 정리하면서 적재
    const seen = new Set<string>();
    const existing: unknown[] = [];
    let removedFromExisting = 0;
    for (const item of rawExisting) {
      const h = contentHash(item);
      if (seen.has(h)) {
        removedFromExisting++;
        continue;
      }
      seen.add(h);
      existing.push(item);
    }

    // 새로 들어오는 것도 동일 해시면 skip
    let added = 0;
    for (const item of incomingItems) {
      const h = contentHash(item);
      if (seen.has(h)) continue;
      seen.add(h);
      existing.push(item);
      added++;
    }

    await updateJob(relatedJob.id, { reviewsData: existing });

    const diagnostics = {
      ok: true,
      jobId: relatedJob.id,
      placeId,
      incoming: incomingItems.length,
      added,
      duplicates: incomingItems.length - added,
      removedFromExisting,
      total: existing.length,
    };
    console.log(`[api/reviews POST]`, diagnostics);
    return Response.json(diagnostics);
  } catch (err) {
    console.error("[api/reviews POST] error:", err);
    return Response.json(
      {
        error: "서버 처리 중 오류 발생",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const { jobId, clearAll, indices } = body as {
      jobId?: string;
      clearAll?: boolean;
      indices?: number[];
    };

    if (!jobId) {
      return Response.json({ error: "jobId가 필요합니다." }, { status: 400 });
    }

    const job = await readJob(jobId);
    if (!job) {
      return Response.json({ error: "job을 찾을 수 없습니다." }, { status: 404 });
    }

    const existing = toArray(job.reviewsData);

    if (clearAll) {
      await updateJob(jobId, {
        reviewsData: [],
        reviewAnalysis: null,
        reviewIntro: null,
        ownerIntro: null,
        menuEvaluation: null,
      });
      return Response.json({ ok: true, deleted: existing.length, remaining: 0 });
    }

    if (Array.isArray(indices) && indices.length > 0) {
      const removeSet = new Set(indices);
      const filtered = existing.filter((_, i) => !removeSet.has(i));
      await updateJob(jobId, { reviewsData: filtered });
      return Response.json({
        ok: true,
        deleted: existing.length - filtered.length,
        remaining: filtered.length,
      });
    }

    return Response.json({ error: "clearAll 또는 indices가 필요합니다." }, { status: 400 });
  } catch (err) {
    console.error("[api/reviews DELETE] error:", err);
    return Response.json(
      { error: "삭제 중 오류 발생", details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const placeId = url.searchParams.get("placeId");
    const jobId = url.searchParams.get("jobId");

    if (!placeId && !jobId) {
      return Response.json(
        { error: "placeId 또는 jobId 쿼리 파라미터가 필요합니다." },
        { status: 400 },
      );
    }

    let job = null;
    if (jobId) {
      job = await readJob(jobId);
    } else if (placeId) {
      const found = await findJobByPlaceId(placeId);
      if (found) job = await readJob(found.id);
    }

    if (!job) {
      return Response.json(
        { error: "일치하는 job을 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    const reviews = toArray(job.reviewsData);
    return Response.json({
      jobId: job.id,
      placeId: job.placeId,
      placeName: job.placeName,
      count: reviews.length,
      reviews,
    });
  } catch (err) {
    console.error("[api/reviews GET] error:", err);
    return Response.json(
      {
        error: "서버 처리 중 오류 발생",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
