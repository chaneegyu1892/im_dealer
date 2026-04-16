export type InventoryStatus = "정상" | "부족" | "소진";

export interface InventoryItem {
  id: string;
  vehicleName: string;       // 차량 전체명
  vehicleShort: string;      // 짧은 이름 (표시용)
  brand: string;             // 브랜드 (현대 / 기아 / 제네시스)
  financeCompany: string;    // 금융사
  quantity: number;          // 보유 수량
  immediateDelivery: boolean; // 즉시 출고 가능 여부
  status: InventoryStatus;   // 재고 상태 (수량 기반 자동 계산 or 수동 설정)
  registeredAt: string;      // 등록/최신 업데이트 날짜
  memo: string;              // 관리자 메모
  lineup?: string;
  trim?: string;
  color?: string;
  options?: string[];
}
