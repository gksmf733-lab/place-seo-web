import { getVerticalConfig } from "@/lib/verticals";

type Props = {
  category: string | null | undefined;
  size?: "sm" | "md";
};

export function VerticalBadge({ category, size = "md" }: Props) {
  const cfg = getVerticalConfig(category);
  const padding = size === "sm" ? "px-2 py-0.5 text-[0.65rem]" : "px-2.5 py-1 text-xs";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${padding}`}
      style={{
        backgroundColor: cfg.bgColor,
        color: cfg.color,
        border: `1px solid ${cfg.color}40`,
      }}
    >
      <span>{cfg.emoji}</span>
      <span>{cfg.label}</span>
    </span>
  );
}
