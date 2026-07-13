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
  monthlyPayment: number;
  totalCost: number;
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
