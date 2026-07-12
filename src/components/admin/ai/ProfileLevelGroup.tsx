import type { SuitabilityLevel } from "@/lib/recommend/overlap-profile";

const levels: readonly { value: SuitabilityLevel; label: string }[] = [
  { value: "best", label: "5 최적" },
  { value: "fit", label: "3 적합" },
  { value: "support", label: "1 보조" },
  { value: "none", label: "0 없음" },
];

interface Props<Key extends string> {
  readonly title: string;
  readonly entries: readonly { readonly key: Key; readonly label: string; readonly value: SuitabilityLevel }[];
  readonly onChange: (key: Key, value: SuitabilityLevel) => void;
}

export default function ProfileLevelGroup<Key extends string>({ title, entries, onChange }: Props<Key>) {
  return (
    <fieldset className="space-y-2 rounded-2xl border border-[#E8EAF2] p-3">
      <legend className="px-1 text-xs font-bold text-[#1A1A2E]">{title}</legend>
      {entries.map((entry) => (
        <label key={entry.key} className="grid grid-cols-[minmax(92px,1fr)_minmax(120px,1.3fr)] items-center gap-2 text-xs">
          <span className="text-[#5A6080]">{entry.label}</span>
          <select
            aria-label={`${title} ${entry.label}`}
            value={entry.value}
            onChange={(event) => {
              const level = levels.find((candidate) => candidate.value === event.target.value);
              if (level) onChange(entry.key, level.value);
            }}
            className="min-w-0 rounded-xl border border-[#E8EAF2] bg-white px-2 py-2 text-xs focus:border-[#6066EE] focus:outline-none"
          >
            {levels.map((level) => <option key={level.value} value={level.value}>{level.label}</option>)}
          </select>
        </label>
      ))}
    </fieldset>
  );
}
