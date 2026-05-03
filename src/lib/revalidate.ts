import { revalidatePath } from "next/cache";

// 차량 목록(홈)·차량 상세 양쪽에 영향을 주는 데이터(차량/트림/옵션/요율표/금융사) 변경 시 사용.
export function revalidatePublicVehicleSurfaces(): void {
  revalidatePath("/", "page");
  revalidatePath("/cars/[slug]", "page");
}

// 후기 변경 시: 홈은 전체 후기 노출, 차량 상세는 해당 차량 후기.
export function revalidatePublicReviewSurfaces(): void {
  revalidatePath("/", "page");
  revalidatePath("/cars/[slug]", "page");
}
