import { promises as fs } from "node:fs";
import path from "node:path";
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
  worksheetPath?: string;
  scrapePath?: string;
  scrapeError?: string;
  scrapeStartedAt?: string;
  scrapeFinishedAt?: string;
};

const JOBS_DIR = path.join(process.cwd(), "data", "jobs");

function jobPath(id: string): string {
  return path.join(JOBS_DIR, `${id}.json`);
}

export async function saveJob(input: OrderInput): Promise<SavedJob> {
  const id = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const record: SavedJob = {
    id,
    createdAt: new Date().toISOString(),
    scrapeStatus: "pending",
    ...input,
  };

  await fs.mkdir(JOBS_DIR, { recursive: true });
  await fs.writeFile(
    jobPath(id),
    JSON.stringify(record, null, 2),
    "utf8",
  );

  return record;
}

export async function readJob(id: string): Promise<SavedJob | null> {
  try {
    const raw = await fs.readFile(jobPath(id), "utf8");
    return JSON.parse(raw) as SavedJob;
  } catch {
    return null;
  }
}

export async function updateJob(
  id: string,
  patch: Partial<SavedJob>,
): Promise<SavedJob | null> {
  const current = await readJob(id);
  if (!current) return null;
  const next: SavedJob = { ...current, ...patch };
  await fs.writeFile(jobPath(id), JSON.stringify(next, null, 2), "utf8");
  return next;
}

export async function listJobs(): Promise<SavedJob[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(JOBS_DIR);
  } catch {
    return [];
  }
  const files = entries.filter((f) => f.endsWith(".json"));
  const jobs: SavedJob[] = [];
  for (const f of files) {
    try {
      const raw = await fs.readFile(path.join(JOBS_DIR, f), "utf8");
      jobs.push(JSON.parse(raw) as SavedJob);
    } catch {
      /* skip corrupt */
    }
  }
  // 최신순
  jobs.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return jobs;
}
