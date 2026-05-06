export interface PublicReview {
  id: string;
  displayName: string;
  rating: number;
  content: string;
  vehicleId: string | null;
  vehicleName: string | null;
  vehicleBrand: string | null;
  reviewDate: string;
  imageUrls: string[];
  isBest: boolean;
  likeCount: number;
}

export interface AdminReview {
  id: string;
  authorRealName: string;
  displayName: string;
  rating: number;
  content: string;
  vehicleId: string | null;
  vehicleName: string | null;
  savedQuoteId: string | null;
  linkedCustomerName: string | null;
  linkedCustomerPhoneMasked: string | null;
  linkedQuoteVehicleName: string | null;
  linkedQuoteCreatedAt: string | null;
  isPublic: boolean;
  isBest: boolean;
  displayOrder: number;
  likeCount: number;
  reviewDate: string;
  imageUrls: string[];
  createdAt: string;
  updatedAt: string;
}

export type ReviewSort = "recent" | "rating" | "popular";

export interface PublicReviewListParams {
  vehicleId?: string;
  brand?: string;
  ratings?: number[];
  withImages?: boolean;
  sort?: ReviewSort;
  cursor?: string;
  limit?: number;
}

export interface PublicReviewListResult {
  items: PublicReview[];
  nextCursor: string | null;
}

export interface AdminReviewVehicleOption {
  id: string;
  name: string;
  brand: string;
}

export interface CustomerSearchResult {
  savedQuoteId: string;
  customerName: string;
  phoneMasked: string;
  customerType: string;
  vehicleId: string | null;
  vehicleName: string | null;
  createdAt: string;
  status: string;
  statusLabel: string;
}

export type ReviewRequestTokenStatus =
  | "unused"
  | "used"
  | "expired"
  | "revoked";

export interface ReviewRequestTokenSummary {
  id: string;
  token: string;
  url: string;
  savedQuoteId: string;
  customerName: string | null;
  customerPhoneMasked: string | null;
  vehicleName: string | null;
  quoteCreatedAt: string | null;
  status: ReviewRequestTokenStatus;
  expiresAt: string;
  createdAt: string;
  usedAt: string | null;
  revokedAt: string | null;
  reviewId: string | null;
}

export interface ReviewWriteContext {
  vehicleName: string | null;
  customerDisplayName: string;
  quoteCreatedAt: string | null;
}
