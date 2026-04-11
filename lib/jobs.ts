import { supabase } from "./supabase";
import crypto from "node:crypto";

export type OrderInput = {
  url: string;
  placeName: string;
  contact: string;
  memo?: string;
};

export type ScrapeStatus = "pending" | "processing" | "done" | "failed";

export type SavedJob = OrderInput & {
  id: string;
  createdAt: string;
  scrapeStatus: ScrapeStatus;
  placeId?: string;
  scrapeError?: string;
  scrapeStartedAt?: string;
  scrapeFinishedAt?: string;
  scrapedData?: any;
  reviewsData?: any;
  worksheetMarkdown?: string;
  canvasPulledAt?: string | null;
};

export async function saveJob(input: OrderInput): Promise<SavedJob> {
  const id = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const record: SavedJob = {
    id,
    createdAt: new Date().toISOString(),
    scrapeStatus: "pending",
    ...input,
  };

  const { error } = await supabase.from("jobs").insert({
    id: record.id,
    url: record.url,
    place_name: record.placeName,
    contact: record.contact,
    memo: record.memo,
    scrape_status: record.scrapeStatus,
    created_at: record.createdAt,
  });

  if (error) {
    throw new Error(`DB 저장 실패: ${error.message}`);
  }

  return record;
}

export async function readJob(id: string): Promise<SavedJob | null> {
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    url: data.url,
    placeName: data.place_name,
    contact: data.contact,
    memo: data.memo,
    scrapeStatus: data.scrape_status,
    placeId: data.place_id,
    scrapeError: data.scrape_error,
    scrapeStartedAt: data.scrape_started_at,
    scrapeFinishedAt: data.scrape_finished_at,
    createdAt: data.created_at,
    scrapedData: data.scraped_data,
    reviewsData: data.reviews_data,
    worksheetMarkdown: data.worksheet_markdown,
    canvasPulledAt: data.canvas_pulled_at ?? null,
  };
}

export async function updateJob(
  id: string,
  patch: Partial<SavedJob>,
): Promise<SavedJob | null> {
  const updates: Record<string, any> = {};
  if (patch.scrapeStatus !== undefined) updates.scrape_status = patch.scrapeStatus;
  if (patch.placeId !== undefined) updates.place_id = patch.placeId;
  if (patch.scrapeError !== undefined) updates.scrape_error = patch.scrapeError;
  if (patch.scrapeStartedAt !== undefined) updates.scrape_started_at = patch.scrapeStartedAt;
  if (patch.scrapeFinishedAt !== undefined) updates.scrape_finished_at = patch.scrapeFinishedAt;
  if (patch.scrapedData !== undefined) updates.scraped_data = patch.scrapedData;
  if (patch.reviewsData !== undefined) updates.reviews_data = patch.reviewsData;
  if (patch.worksheetMarkdown !== undefined) updates.worksheet_markdown = patch.worksheetMarkdown;
  if (patch.canvasPulledAt !== undefined) updates.canvas_pulled_at = patch.canvasPulledAt;

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase.from("jobs").update(updates).eq("id", id);
    if (error) console.error("[jobs.ts] Update Error:", error);
  }

  return await readJob(id);
}

/**
 * AI Canvas Pull 전용: 스크래핑이 완료됐고 아직 Canvas로 pulled 되지 않은 job 목록.
 * 호출 측(route handler)에서 반환 직후 markJobsCanvasPulled 로 마킹해서
 * 다음 호출에는 중복으로 나오지 않도록 해야 한다.
 */
export async function listJobsForCanvasPull(): Promise<SavedJob[]> {
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("scrape_status", "done")
    .is("canvas_pulled_at", null)
    .not("place_id", "is", null)
    .order("created_at", { ascending: true });

  if (error || !data) {
    console.error("[jobs.ts] listJobsForCanvasPull error:", error);
    return [];
  }

  return data.map((d: any) => ({
    id: d.id,
    url: d.url,
    placeName: d.place_name,
    contact: d.contact,
    memo: d.memo,
    scrapeStatus: d.scrape_status,
    placeId: d.place_id,
    scrapeError: d.scrape_error,
    scrapeStartedAt: d.scrape_started_at,
    scrapeFinishedAt: d.scrape_finished_at,
    createdAt: d.created_at,
    scrapedData: d.scraped_data,
    reviewsData: d.reviews_data,
    worksheetMarkdown: d.worksheet_markdown,
    canvasPulledAt: d.canvas_pulled_at ?? null,
  }));
}

export async function markJobsCanvasPulled(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from("jobs")
    .update({ canvas_pulled_at: new Date().toISOString() })
    .in("id", ids);
  if (error) {
    console.error("[jobs.ts] markJobsCanvasPulled error:", error);
  }
}

export async function resetCanvasPulled(id: string): Promise<void> {
  const { error } = await supabase
    .from("jobs")
    .update({ canvas_pulled_at: null })
    .eq("id", id);
  if (error) {
    console.error("[jobs.ts] resetCanvasPulled error:", error);
  }
}

export async function listJobs(): Promise<SavedJob[]> {
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !data) {
    console.error("[jobs.ts] List Jobs Error:", error);
    return [];
  }

  return data.map((d: any) => ({
    id: d.id,
    url: d.url,
    placeName: d.place_name,
    contact: d.contact,
    memo: d.memo,
    scrapeStatus: d.scrape_status,
    placeId: d.place_id,
    scrapeError: d.scrape_error,
    scrapeStartedAt: d.scrape_started_at,
    scrapeFinishedAt: d.scrape_finished_at,
    createdAt: d.created_at,
  }));
}
