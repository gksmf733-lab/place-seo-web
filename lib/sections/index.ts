import { promises as fs } from "node:fs";
import path from "node:path";
import YAML from "yaml";

export type Section = {
  name: string;
  description: string;
  order: number;
  guide: string;
  prompt: string;
};

const DEFAULT_SECTIONS_DIR = path.join(process.cwd(), "data", "sections");

export async function loadSections(
  sectionsDir: string = DEFAULT_SECTIONS_DIR,
): Promise<Section[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(sectionsDir);
  } catch {
    return [];
  }

  const files = entries.filter((f) => f.endsWith(".yaml"));
  const sections: Section[] = [];
  for (const f of files.sort()) {
    const raw = await fs.readFile(path.join(sectionsDir, f), "utf8");
    const parsed = YAML.parse(raw);
    if (parsed && typeof parsed === "object") {
      sections.push({
        name: String(parsed.name ?? ""),
        description: String(parsed.description ?? ""),
        order:
          typeof parsed.order === "number" ? parsed.order : 999,
        guide: String(parsed.guide ?? ""),
        prompt: String(parsed.prompt ?? ""),
      });
    }
  }
  sections.sort((a, b) => a.order - b.order);
  return sections;
}
