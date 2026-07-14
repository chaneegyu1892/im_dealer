interface QuoteContactInput {
  quoteName?: string | null;
  quotePhone?: string | null;
  memberName?: string | null;
  memberPhone?: string | null;
}

const NAME_PLACEHOLDERS = new Set(["고객"]);
const PHONE_PLACEHOLDERS = new Set(["연락처 미입력"]);

function meaningfulValue(value: string | null | undefined, placeholders: Set<string>) {
  const normalized = value?.trim();
  if (!normalized || placeholders.has(normalized)) return null;
  return normalized;
}

export function resolveQuoteContact(input: QuoteContactInput): {
  customerName: string | null;
  phone: string | null;
} {
  return {
    customerName:
      meaningfulValue(input.quoteName, NAME_PLACEHOLDERS) ??
      meaningfulValue(input.memberName, NAME_PLACEHOLDERS),
    phone:
      meaningfulValue(input.quotePhone, PHONE_PLACEHOLDERS) ??
      meaningfulValue(input.memberPhone, PHONE_PLACEHOLDERS),
  };
}
