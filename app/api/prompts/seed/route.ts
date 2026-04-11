import { seedFromYaml } from "@/lib/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const result = await seedFromYaml();
  return Response.json({ ok: true, ...result });
}
