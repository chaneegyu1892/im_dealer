# 어드민 페이지 명세서

> **대상 경로**: `src/app/(admin)/`, `src/components/admin/`, `src/app/api/admin/`
>
> 이 문서는 현재 구현된 어드민 페이지의 프론트엔드 디자인과 백엔드 기능의 기준 명세다.
> 협업자 코드 병합 후 회귀가 발생하면 이 문서를 기준으로 복구해라.

---

## 전체 구조

```
어드민 레이아웃 (AdminLayout)
  ├─ 사이드바 (AdminSidebar) — 220px 고정
  └─ 메인 영역 (flex-1)
       ├─ /admin               → 대시보드
       ├─ /admin/analytics     → 데이터 분석
       ├─ /admin/quotations    → 견적 데이터
       ├─ /admin/vehicles      → 차량 관리 목록
       └─ /admin/vehicles/[id] → 차량 상세 편집
```

---

## 1. 레이아웃 & 네비게이션

### `src/app/(admin)/layout.tsx`

- 사이드바(220px) + 메인 콘텐츠 전체 높이 레이아웃
- 배경색: `#0D0D1F` (다크)
- `AdminSidebar` 컴포넌트 포함

### `src/components/admin/AdminSidebar.tsx`

- 메뉴 항목: 대시보드 / 데이터 분석 / 견적 데이터 / 차량 관리
- 현재 경로 기준 활성 상태 표시 (좌측 컬러 라인 인디케이터)
- 하단 사용자 정보 표시
- Accent 색상: `#6066EE`

---

## 2. 대시보드 (`/admin`)

### 데이터 흐름

```
page.tsx (SSR)
  └─ getDashboardData()  ← lib/admin-queries.ts
       └─ Prisma 병렬 쿼리
  └─ <DashboardClient data={...} />
```

### `src/components/admin/DashboardClient.tsx`

#### KPI 카드 (5개)

| 카드 | 데이터 소스 |
|------|------------|
| 총 차량 수 | `vehicle.count()` |
| 노출 중 차량 | `vehicle.count({ isVisible: true })` |
| 오늘 견적 조회 | `explorationLog.count({ eventType: 'quote_view', today })` |
| 오늘 AI 세션 | `recommendationLog.count({ today })` |
| 이달 견적 저장 | `savedQuote.count({ this month })` |

#### 차트 (4종, 페이지 네비게이션)

| 탭 | 차트 컴포넌트 | 데이터 |
|----|-------------|--------|
| 주간 견적 조회 | `LineChart` | explorationLog 7일 |
| 주간 AI 추천 | `LineChart` | recommendationLog 7일 |
| 카테고리 분포 | `DonutChart` | vehicle.groupBy(category) |
| 월별 견적 저장 | `BarChart` | savedQuote 6개월 집계 |

#### 하단 3열

- **인기 차량**: explorationLog 기준 Top 5 (이번 달)
- **빠른 액션**: 링크 버튼 모음
- **최근 활동**: operationalNote 최근 5건

---

## 3. 데이터 분석 (`/admin/analytics`)

### 데이터 흐름

```
page.tsx (SSR)
  └─ getAnalyticsData()  ← lib/admin-queries.ts
  └─ <AnalyticsDashboard data={...} />
```

### `src/components/admin/AnalyticsDashboard.tsx`

#### KPI 카드 (3개)

| 카드 | 계산 방식 |
|------|----------|
| 총 견적 조회 | COUNT(explorationLog) 30일 |
| 고유 방문 세션 | COUNT(DISTINCT sessionId) |
| 견적 전환율 | savedQuote / explorationLog × 100 |

#### 메인 차트
- 30일 일간 견적 조회 트렌드 (Framer Motion 애니메이션 포함)
- SVG 라인 차트, 그래디언트 영역

#### 사이드 패널
- **차량별 견적 순위** Top 5 — 프로그레스 바
- **파워트레인 분포** — 인라인 도넛 차트 (`DonutPie` 내부 컴포넌트)

---

## 4. 견적 데이터 (`/admin/quotations`)

### 데이터 흐름

```
page.tsx (SSR)
  └─ getAdminQuotes(1, 100)  ← lib/admin-queries.ts
  └─ <QuotationTable initialQuotes={...} total={...} />
```

### `src/components/admin/quotations/QuotationTable.tsx`

#### Props

```typescript
interface QuotationTableProps {
  initialQuotes: AdminSavedQuote[];
  total: number;
}
```

#### 테이블 컬럼

| 컬럼 | 내용 |
|------|------|
| 차량 | 브랜드 + 차량명 |
| 트림 | 트림명 |
| 계약 조건 | 기간 / 주행거리 |
| 월 납입금 | 포맷된 금액 |
| 계약 유형 | 배지 (파랑=장기렌트, 보라=인수형) |
| 접수일 | 날짜 포맷 |

#### KPI 카드 (테이블 상단, 3개)

- 전체 견적 수
- 장기렌트 건수
- 인수형 건수

#### 검색
- 차량명 / 트림명 클라이언트 사이드 필터

#### Drawer (우측 슬라이드)

트리거: 테이블 행 클릭  
닫기: ESC 키 또는 backdrop 클릭

**Drawer 섹션 구성 (순서 고정)**

1. **기본 정보**
   - 차량 (브랜드 + 이름)
   - 트림
   - 계약 기간 / 주행거리
   - 보증금 / 선납금
   - 계약 유형

2. **월 납입금 하이라이트**
   - 검은색 배경, 큰 폰트 강조

3. **추가 정보**
   - 총 비용
   - 세션 ID
   - 접수일

4. **고객 서류 제출 링크**
   - 링크 URL 표시
   - 링크 복사 버튼 (클립보드)
   - 새 탭으로 열기 버튼

5. **서류 확인 결과**
   - `<VerificationResult sessionId={...} />`

---

## 5. 서류 확인 결과 컴포넌트

### `src/components/admin/VerificationResult.tsx`

#### Props

```typescript
interface Props {
  sessionId: string;
}
```

#### 데이터 타입

```typescript
interface VerificationRecord {
  id: string;
  sessionId: string;
  customerType: string;         // 'individual' | 'self_employed' | 'corporate'
  connectedId: string | null;
  licenseVerified: boolean;
  insuranceVerified: boolean;
  bizVerified: boolean;
  licenseData: Record<string, unknown> | null;
  insuranceData: Record<string, unknown> | null;
  bizData: Record<string, unknown> | null;
  consentedAt: string;
  verifiedAt: string | null;
  createdAt: string;
}
```

#### API 호출

```
GET /api/verification/session/{sessionId}
```

#### 렌더링 흐름

```
컴포넌트 마운트
  └─ fetch /api/verification/session/{sessionId}
       ├─ 로딩: 스피너 + "조회 중..."
       ├─ 에러 또는 미제출: Alert 아이콘 + 안내 메시지
       └─ 성공:
            ├─ 고객 유형 + 조회 시간
            ├─ 운전면허 진위확인 (항상 표시)
            │    └─ detail: licenseData.resLicenseStatus
            ├─ 건강보험 자격득실 (individual / self_employed 만)
            │    └─ detail: insuranceData.resWorkplaceName
            └─ 사업자등록 상태 (self_employed / corporate 만)
                 └─ detail: bizData.resBizStatus
```

#### StatusBadge 상태값

| 상태 | 조건 | 표시 |
|------|------|------|
| verified | `xxxVerified === true` | ✓ 확인됨 (초록) |
| failed | 데이터 있으나 false | ✗ 불일치 (빨강) |
| pending | 데이터 없음 | 🕐 미조회 (회색) |

#### 데이터 추출 헬퍼

```typescript
extractLicenseDetail(data)   → licenseData에서 resLicenseStatus 추출
extractInsuranceDetail(data) → insuranceData에서 resWorkplaceName 추출
extractBizDetail(data)       → bizData에서 resBizStatus 추출
```

---

## 6. 차량 관리 (`/admin/vehicles`)

### 데이터 흐름

```
page.tsx (SSR)
  └─ Promise.all([getAdminVehicles(), getAdminBrands()])
  └─ <VehicleManager vehicles={...} brands={...} />
```

### `src/components/admin/vehicles/VehicleManager.tsx`

3열 레이아웃 (좌 280px | 중 360px | 우 flex-1)

| 열 | 컴포넌트 | 역할 |
|----|----------|------|
| 좌 | `BrandList` | 브랜드 선택 + 차량 수 배지 |
| 중 | `VehicleList` | 선택 브랜드의 차량 목록 + 검색 |
| 우 | `VehicleDetail` | 선택 차량 상세 정보 |

#### 모달 3종

| 모달 | 컴포넌트 | 트리거 |
|------|----------|--------|
| 차량 생성/수정 | `VehicleFormModal` | 추가 버튼 / 편집 아이콘 |
| 차량 삭제 확인 | `DeleteVehicleModal` | 삭제 아이콘 |
| 옵션 관리 | `OptionManager` | TrimManager 내부 |

#### VehicleFormModal 필드

```
차량명       (required)
브랜드       (읽기 전용)
분류         세단 | SUV | 밴 | 트럭
기준가       만원 단위 (required)
※ 트림/엔진/이미지는 상세 편집 페이지에서
```

---

## 7. 차량 상세 편집 (`/admin/vehicles/[id]`)

### 데이터 흐름

```
page.tsx (SSR)
  └─ getVehicleById(id)  ← trims + options 포함
  └─ <VehicleEditor vehicle={...} />
```

### `src/components/admin/vehicles/VehicleEditor.tsx`

2열 레이아웃 (좌 flex-1 | 우 flex-1)

#### 좌열: `VehicleInfoForm`

```typescript
interface VehicleEditData {
  brand: string;
  name: string;
  category: VehicleCategory;
  basePrice: number;
  description: string;
  thumbnailUrl: string;
  imageUrls: string[];
  surchargeRate: number;
  isVisible: boolean;
  isPopular: boolean;
  displayOrder: number;
  vehicleCode: string;
  slug: string;
}
```

- 썸네일 미리보기 (URL 입력 시 실시간)
- 이미지 URL 동적 추가/제거 (배열)
- 노출 / 인기 체크박스

#### 우열: `TrimManager`

트림 목록 (isDefault 배지, 엔진타입 라벨) + 하위 옵션 중첩 표시

**트림 모달 필드**

```
트림명        (required)
가격          만원 단위 (required)
엔진 타입     가솔린 | 디젤 | 하이브리드 | EV
연비          km/L
기본 트림     체크박스
노출          체크박스
```

**옵션 모달 필드 (`OptionManager`)**

```
옵션명        (required)
추가 가격     원 단위 (required)
카테고리      예: 외관
설명
기본 포함     체크박스
액세서리      체크박스
```

---

## 8. 차트 컴포넌트 (SVG 직접 구현)

> 외부 차트 라이브러리(Recharts 등) 사용 금지. 아래 3개 컴포넌트로 유지.

### `LineChart.tsx`

```typescript
interface Props {
  data: DailyCount[];   // { date: string; count: number }[]
  color: string;
}
```

- SVG 라인 + 그래디언트 영역 + 점 + 요일 라벨

### `BarChart.tsx`

```typescript
interface Props {
  data: { label: string; value: number }[];
  color: string;
}
```

- 투명 배경 바 + 채워진 바 + 값 라벨

### `DonutChart.tsx`

```typescript
interface Props {
  data: CategoryCount[];  // { category: string; count: number }[]
}
```

- 원형 + 범례 + 총 개수 중앙 표시

---

## 9. API Routes 전체 목록

### 차량 관리

| Method | Endpoint | Prisma 작업 |
|--------|----------|-------------|
| GET | `/api/admin/vehicles` | `vehicle.findMany(where, orderBy)` |
| POST | `/api/admin/vehicles` | `vehicle.create()` |
| GET | `/api/admin/vehicles/[id]` | `vehicle.findUnique()` + trims + options |
| PATCH | `/api/admin/vehicles/[id]` | `vehicle.update()` |
| DELETE | `/api/admin/vehicles/[id]` | `vehicle.delete()` |
| POST | `/api/admin/vehicles/[id]/trims` | `trim.create()` + 기본 트림 중복 처리 |
| PATCH | `/api/admin/vehicles/[id]/trims/[trimId]` | `trim.update()` |
| DELETE | `/api/admin/vehicles/[id]/trims/[trimId]` | `trim.delete()` |
| POST | `/api/admin/trims/[trimId]/options` | `trimOption.create()` |
| PATCH | `/api/admin/trims/[trimId]/options/[optionId]` | `trimOption.update()` |
| DELETE | `/api/admin/trims/[trimId]/options/[optionId]` | `trimOption.delete()` |

### 데이터 조회

| Method | Endpoint | 반환 데이터 |
|--------|----------|------------|
| GET | `/api/admin/brands` | `vehicle.groupBy(['brand'])` |
| GET | `/api/admin/quotes` | savedQuote 목록 (페이지네이션) |
| GET | `/api/admin/dashboard/stats` | KPI + 차트 데이터 |
| GET | `/api/admin/analytics` | 30일 집계 분석 |

### 서류 확인

| Method | Endpoint | 반환 데이터 |
|--------|----------|------------|
| GET | `/api/verification/session/[sessionId]` | VerificationRecord |

---

## 10. lib/admin-queries.ts 핵심 함수

| 함수 | 사용처 | 쿼리 요약 |
|------|--------|-----------|
| `getAdminVehicles(brand?)` | 차량 목록 페이지 | `vehicle.findMany` + `_count.trims` |
| `getVehicleById(id)` | 차량 편집 페이지 | `vehicle.findUnique` + trims + options |
| `getAdminBrands()` | 차량 목록 페이지 | `vehicle.groupBy(['brand'])` |
| `getDashboardData()` | 대시보드 | `Promise.all` 다중 집계 |
| `getAnalyticsData()` | 분석 페이지 | 30일 로그 집계 |
| `getAdminQuotes(page, limit)` | 견적 페이지 | `savedQuote.findMany` + 포맷 |

---

## 11. UI/UX 규칙

### 색상 체계 (변경 금지)

| 용도 | 값 |
|------|----|
| Primary (짙은 파랑) | `#000666` |
| Accent (밝은 파랑) | `#6066EE` |
| 레이아웃 배경 | `#0D0D1F` |
| 페이지 배경 | `#F8F9FC` |
| 주요 텍스트 | `#1A1A2E` |
| 보조 텍스트 | `#9BA4C0` |

### 인터랙션 패턴

| 패턴 | 구현 방식 |
|------|-----------|
| 모달 | Framer Motion 애니메이션 + 배경 blur |
| Drawer | 우측 슬라이드 + backdrop (ESC로 닫기) |
| 테이블 행 | 호버 하이라이트 + 클릭 선택 |
| 배지 | 계약유형 파랑/보라, 상태별 초록/빨강/회색 |

### 의존 라이브러리

- `framer-motion` — 모달/차트 애니메이션
- `lucide-react` — 아이콘
- SVG 직접 구현 — 차트 전용 (외부 차트 라이브러리 없음)

---

## 12. 자주 발생하는 회귀 패턴

| 증상 | 원인 | 확인할 파일 |
|------|------|-------------|
| Drawer가 안 열림 | selectedId state 초기화 로직 변경 | QuotationTable.tsx |
| 서류 확인 결과 미표시 | VerificationResult 미임포트 | QuotationTable.tsx |
| 차트 빈 화면 | SVG viewBox 계산 오류 | LineChart / BarChart / DonutChart |
| KPI 카드 0 표시 | SSR 쿼리 함수 미호출 | admin-queries.ts + page.tsx |
| 차량 목록 브랜드 필터 안됨 | VehicleManager 상태 전달 누락 | VehicleManager.tsx → VehicleList.tsx |
| 트림 삭제 후 목록 미갱신 | 로컬 state 동기화 누락 | TrimManager.tsx |
