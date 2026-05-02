import {
  getAllReviewsForAdmin,
  getVehiclesForReviewSelect,
} from "@/lib/admin-queries";
import { ReviewManager } from "@/components/admin/reviews/ReviewManager";

export const dynamic = "force-dynamic";

export default async function AdminReviewsPage() {
  const [reviews, vehicles] = await Promise.all([
    getAllReviewsForAdmin(),
    getVehiclesForReviewSelect(),
  ]);

  return <ReviewManager initialReviews={reviews} vehicleOptions={vehicles} />;
}
