export const CUSTOMER_TYPES = [
  "individual",
  "self_employed",
  "corporate",
  "nonprofit",
] as const;

export type CustomerType = (typeof CUSTOMER_TYPES)[number];

export const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  individual: "개인",
  self_employed: "개인사업자",
  corporate: "법인",
  nonprofit: "비영리법인",
};

export function isCustomerType(value: string | null | undefined): value is CustomerType {
  return CUSTOMER_TYPES.includes(value as CustomerType);
}

export function industryToCustomerType(industry: string | null | undefined): CustomerType {
  switch (industry) {
    case "법인":
      return "corporate";
    case "개인사업자":
      return "self_employed";
    case "직장인":
    case "개인":
    default:
      return "individual";
  }
}
