import {
  getAllReviewsForAdmin,
  getVehiclesForReviewSelect,
  getReviewRequestTokensForAdmin,
} from "@/lib/admin-queries";
import { ReviewsPageClient } from "@/components/admin/reviews/ReviewsPageClient";

export const dynamic = "force-dynamic";

export default async function AdminReviewsPage() {
  const [reviews, vehicles, tokens] = await Promise.all([
    getAllReviewsForAdmin(),
    getVehiclesForReviewSelect(),
    getReviewRequestTokensForAdmin(),
  ]);

  return (
    <ReviewsPageClient
      initialReviews={reviews}
      vehicleOptions={vehicles}
      initialTokens={tokens}
    />
  );
}
