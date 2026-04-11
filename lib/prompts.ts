import { supabase } from "./supabase";

export type SectionType = "intro" | "keywords" | "menu" | string;

export type Prompt = {
  id: string;
  sectionType: SectionType;
  name: string;
  description: string;
  guide: string;
  promptTemplate: string;
  isDefault: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type PromptInput = {
  sectionType: SectionType;
  name: string;
  description?: string;
  guide?: string;
  promptTemplate: string;
  isDefault?: boolean;
  sortOrder?: number;
};

type DbRow = {
  id: string;
  section_type: string;
  name: string;
  description: string | null;
  guide: string | null;
  prompt_template: string;
  is_default: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

function fromRow(row: DbRow): Prompt {
  return {
    id: row.id,
    sectionType: row.section_type,
    name: row.name,
    description: row.description ?? "",
    guide: row.guide ?? "",
    promptTemplate: row.prompt_template,
    isDefault: row.is_default,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listPrompts(
  sectionType?: SectionType,
): Promise<Prompt[]> {
  let query = supabase
    .from("prompts")
    .select("*")
    .order("section_type", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (sectionType) {
    query = query.eq("section_type", sectionType);
  }
  const { data, error } = await query;
  if (error) {
    console.error("[lib/prompts] listPrompts error:", error);
    return [];
  }
  return (data as DbRow[] | null)?.map(fromRow) ?? [];
}

export async function readPrompt(id: string): Promise<Prompt | null> {
  const { data, error } = await supabase
    .from("prompts")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) return null;
  return fromRow(data as DbRow);
}

export async function createPrompt(input: PromptInput): Promise<Prompt | null> {
  const { data, error } = await supabase
    .from("prompts")
    .insert({
      section_type: input.sectionType,
      name: input.name,
      description: input.description ?? "",
      guide: input.guide ?? "",
      prompt_template: input.promptTemplate,
      is_default: input.isDefault ?? false,
      sort_order: input.sortOrder ?? 0,
    })
    .select()
    .single();
  if (error || !data) {
    console.error("[lib/prompts] createPrompt error:", error);
    return null;
  }
  return fromRow(data as DbRow);
}

export async function updatePrompt(
  id: string,
  patch: Partial<PromptInput>,
): Promise<Prompt | null> {
  const updates: Record<string, unknown> = {};
  if (patch.sectionType !== undefined) updates.section_type = patch.sectionType;
  if (patch.name !== undefined) updates.name = patch.name;
  if (patch.description !== undefined) updates.description = patch.description;
  if (patch.guide !== undefined) updates.guide = patch.guide;
  if (patch.promptTemplate !== undefined)
    updates.prompt_template = patch.promptTemplate;
  if (patch.isDefault !== undefined) updates.is_default = patch.isDefault;
  if (patch.sortOrder !== undefined) updates.sort_order = patch.sortOrder;

  const { data, error } = await supabase
    .from("prompts")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error || !data) {
    console.error("[lib/prompts] updatePrompt error:", error);
    return null;
  }
  return fromRow(data as DbRow);
}

export async function deletePrompt(id: string): Promise<boolean> {
  const { error } = await supabase.from("prompts").delete().eq("id", id);
  if (error) {
    console.error("[lib/prompts] deletePrompt error:", error);
    return false;
  }
  return true;
}

export async function seedFromYaml(): Promise<{
  created: number;
  skipped: number;
}> {
  const { loadSections } = await import("@/lib/sections");
  const sections = await loadSections();
  const { data: existing, error } = await supabase
    .from("prompts")
    .select("id")
    .limit(1);
  if (error) {
    console.error("[lib/prompts] seed check error:", error);
    return { created: 0, skipped: 0 };
  }
  if (existing && existing.length > 0) {
    return { created: 0, skipped: sections.length };
  }

  const SECTION_TYPE_MAP: Record<string, SectionType> = {
    "업체 소개글": "intro",
    "대표 키워드 / 해시태그": "keywords",
    "메뉴/상품 설명": "menu",
  };

  let created = 0;
  for (const sec of sections) {
    const sectionType = SECTION_TYPE_MAP[sec.name] ?? "custom";
    const result = await createPrompt({
      sectionType,
      name: sec.name,
      description: sec.description,
      guide: sec.guide,
      promptTemplate: sec.prompt,
      isDefault: true,
      sortOrder: sec.order,
    });
    if (result) created++;
  }
  return { created, skipped: 0 };
}

/**
 * 주어진 섹션 타입의 기본 프롬프트(또는 첫 번째)를 반환.
 * 선택된 promptId가 있으면 그걸 우선 사용.
 */
export async function resolvePrompt(
  sectionType: SectionType,
  preferredId?: string,
): Promise<Prompt | null> {
  if (preferredId) {
    const preferred = await readPrompt(preferredId);
    if (preferred && preferred.sectionType === sectionType) {
      return preferred;
    }
  }
  const list = await listPrompts(sectionType);
  const def = list.find((p) => p.isDefault);
  return def ?? list[0] ?? null;
}
