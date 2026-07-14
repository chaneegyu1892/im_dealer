export type QuoteCrmStatus = "NEW" | "CONTACTED" | "IN_PROGRESS" | "CONVERTED" | "LOST";

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
