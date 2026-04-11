"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

type PromptOption = {
  id: string;
  name: string;
  isDefault: boolean;
};

type Props = {
  sectionType: string;
  options: PromptOption[];
  selectedId: string;
};

export function PromptPicker({ sectionType, options, selectedId }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (options.length <= 1) {
    return null;
  }

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newId = e.target.value;
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set(sectionType, newId);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor={`picker-${sectionType}`}
        className="text-xs text-muted-foreground"
      >
        프롬프트:
      </label>
      <select
        id={`picker-${sectionType}`}
        value={selectedId}
        onChange={onChange}
        className="h-7 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
            {o.isDefault ? " (기본)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
