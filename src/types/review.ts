export interface PublicReview {
  id: string;
  displayName: string;
  rating: number;
  content: string;
  vehicleName: string | null;
  reviewDate: string;
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
  displayOrder: number;
  reviewDate: string;
  createdAt: string;
  updatedAt: string;
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
