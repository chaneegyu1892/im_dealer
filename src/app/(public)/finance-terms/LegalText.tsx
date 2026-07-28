const NON_BREAKING_COMPOUND_PATTERN = /([^\s·]+(?:·[^\s·]+)+)/g;

type LegalTextProps = {
  readonly text: string;
};

export function LegalText({ text }: LegalTextProps) {
  return text.split(NON_BREAKING_COMPOUND_PATTERN).map((segment, index) =>
    segment.includes("·") ? (
      <span key={`${segment}-${index}`} className="whitespace-nowrap">
        {segment}
      </span>
    ) : (
      segment
    ),
  );
}
