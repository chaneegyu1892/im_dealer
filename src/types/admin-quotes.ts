export type QuoteCrmStatus = "NEW" | "CONTACTED" | "IN_PROGRESS" | "CONVERTED" | "LOST";

/** QuoteDelivery.status. NONE = 해당 견적에 전달 행이 없음(미전달과 구분). */
export type AdminQuoteDeliveryStatus = "SENT" | "PENDING" | "FAILED" | "NONE";

export interface AdminQuoteDelivery {
  status: AdminQuoteDeliveryStatus;
  failReason: string | null;
  createdAt: string | null;
  sentAt: string | null;
}

export interface AdminQuoteAlimtalk {
  status: string;
  failReason: string | null;
  resultCode: string | null;
  templateKey: string;
  createdAt: string;
  resultAt: string | null;
}

export interface AdminSavedQuote {
  id: string;
  sessionId: string;
  userId: string | null;
  customerName: string | null;
  phone: string | null;
  vehicleId: string;
  vehicleName: string;
  vehicleBrand: string;
  trimId: string;
  trimName: string;
  trimPrice: number | null;
  discountPrice: number | null;
  contractMonths: number;
  annualMileage: number;
  depositRate: number;
  prepayRate: number;
  contractType: string;
  customerType: string;
  productType: "장기렌트" | "리스";
  monthlyPayment: number;
  totalCost: number;
  pricingStatus: "CALCULATED" | "CONSULTATION_REQUIRED";
  status: "NEW" | "CONTACTED" | "IN_PROGRESS" | "CONVERTED" | "LOST";
  internalMemo: string | null;
  userType: "Member" | "Guest";
  quoteType: "AI" | "DETAIL";
  createdAt: string;
  updatedAt: string;
  exteriorColorName: string | null;
  exteriorColorHex: string | null;
  interiorColorName: string | null;
  interiorColorHex: string | null;
  selectedOptions: { id: string; name: string; price: number }[];
  /** 최신 QuoteDelivery. 행이 없으면 status=NONE (미전달로 오인 금지). */
  delivery: AdminQuoteDelivery;
  /** 최신 견적 알림톡(refType=quote). 없으면 null. */
  alimtalk: AdminQuoteAlimtalk | null;
}

export interface AdminQuoteCalculation {
  id: string;
  sessionId: string;
  userId: string | null;
  customerName: string | null;
  phone: string | null;
  userType: "Member" | "Guest";
  vehicleId: string;
  vehicleSlug: string;
  vehicleName: string;
  vehicleBrand: string | null;
  trimId: string | null;
  trimName: string | null;
  optionCount: number;
  selectedOptions: { id: string; name: string; price: number }[];
  trimPrice: number | null;
  discountPrice: number | null;
  extraOptionsPrice: number;
  optionsTotalPrice: number;
  exteriorColorName: string | null;
  interiorColorName: string | null;
  colorDelta: number;
  totalVehiclePrice: number | null;
  contractMonths: number;
  annualMileage: number;
  depositRate: number;
  prepayRate: number;
  contractType: string;
  productType: string;
  customerType: string | null;
  resultMonthly: number;
  bestFinanceCompany: string;
  scenarioType: string;
  pricingStatus: "CALCULATED" | "CONSULTATION_REQUIRED";
  clickedApply: boolean;
  deviceType: string | null;
  createdAt: string;
  calculatedAt: string;
}

export interface AdminNotification {
  id: string;
  type: "NEW_QUOTE" | "SYSTEM" | "INQUIRY";
  title: string;
  content: string;
  linkUrl: string | null;
  isRead: boolean;
  createdAt: string;
  status: QuoteCrmStatus;
  assigneeId: string | null;
  internalMemo: string | null;
}
