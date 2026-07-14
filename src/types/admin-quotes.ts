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
