import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export type OrderInput = {
  url: string;
  placeName: string;
  contact: string;
  memo?: string;
};

export type SavedJob = OrderInput & {
  id: string;
  createdAt: string;
};

const JOBS_DIR = path.join(process.cwd(), "data", "jobs");

export async function saveJob(input: OrderInput): Promise<SavedJob> {
  const id = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const record: SavedJob = {
    id,
    createdAt: new Date().toISOString(),
    ...input,
  };

  await fs.mkdir(JOBS_DIR, { recursive: true });
  await fs.writeFile(
    path.join(JOBS_DIR, `${id}.json`),
    JSON.stringify(record, null, 2),
    "utf8",
  );

  return record;
}
