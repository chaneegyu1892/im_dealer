# 마이페이지 쿠폰함 설계

- 작성일: 2026-08-06
- 대상: `/mypage` 회원 영역에 쿠폰함(`/mypage/coupons`) 신설 + 어드민 쿠폰 관리

## 배경

`/mypage` 는 현재 저장 견적을 나열하는 단일 페이지다. 앞으로 회원 기능을 얹어갈
예정이고, 그 첫 번째가 쿠폰함이다.

첫가입 고객과 첫계약 고객에게 주는 혜택이 지금은 어디에도 기록되지 않는다. 코드베이스
전체에 쿠폰·프로모션 모델이 없어 신규 설계다.

아임딜러는 앱 안에서 결제가 일어나지 않는다. 고객은 견적을 보고 상담을 거쳐 오프라인
계약으로 넘어간다. 따라서 쿠폰은 "결제 시 자동 차감되는 할인"이 아니라 **계약 완료 후
지급되는 리워드**(주유권·상품권·축하금)이며, 쿠폰함은 그 약속의 진행 상태를 보여주는
트래킹 화면이다.

## 목표

- 회원이 자기가 받을 혜택과 그 진행 상태를 한 화면에서 확인한다.
- 아직 계약 전인 회원에게 "계약하면 받는다"는 유인을 남긴다.
- 영업담당자가 지급해야 할 쿠폰을 어드민에서 누락 없이 본다.
- 마케팅 조건이 바뀌어도 배포 없이 어드민에서 쿠폰 정책을 수정한다.
- `/mypage` 를 허브 구조로 바꿔 이후 기능(내 상담, 서류함 등)을 붙일 자리를 만든다.

## 비목표

- 견적 계산 로직에 손대지 않는다. 쿠폰은 월 납입금에 반영되지 않는다.
- 고객이 쿠폰을 "사용 신청"하는 흐름을 만들지 않는다. 상태 전이는 계약 여부와 어드민
  지급 처리로만 일어난다.
- 쿠폰 코드에 인증·권한 의미를 부여하지 않는다. 열람·문의용 식별자일 뿐이다.
- 반복 발급 쿠폰(매달 지급 등)은 다루지 않는다. 첫가입·첫계약은 1인 1매다.
- 알림(카카오톡 발송)은 이번 범위가 아니다.

## 쿠폰 생애주기

```
   ┌────────────────────────────────────┐
   │ CouponPolicy (어드민이 관리)         │
   │ trigger = SIGNUP | FIRST_CONTRACT   │
   └─────────────────┬──────────────────┘
                     │ 자격 충족 시 1인 1매 발급
                     ▼
                ┌────────┐  계약 완료(CONVERTED)  ┌─────────┐  어드민 지급 처리  ┌──────┐
                │  HELD  │ ─────────────────────▶ │ PENDING │ ────────────────▶ │ PAID │
                │        │ ◀───────────────────── │         │                   └──────┘
                └───┬────┘      계약 철회          └─────────┘
                    │
                    │ expiresAt 경과
                    ▼
              ┌─────────┐
              │ EXPIRED │
              └─────────┘
```

만료는 `HELD` 에서만 일어난다. `PENDING` 은 만료시키지 않는다 — 조건을 이미 충족한
쿠폰을 시간 때문에 뺏으면 안 된다. `PAID` 는 종착 상태다.

`REVOKED` 는 어드민이 수동으로만 만든다(오발급 정정 등). 시스템이 자동으로 넣지 않는다.

계약이 철회되면(`CONVERTED` → 다른 상태) `PENDING` 만 `HELD` 로 되돌린다. **`PAID` 는
건드리지 않는다.** 이미 지급한 리워드를 시스템이 임의로 회수 상태로 만들면 안 된다.

## 데이터 모델

`prisma/schema.prisma` 에 enum 2개, model 2개를 추가한다.

```prisma
enum CouponTrigger {
  SIGNUP         // 첫가입
  FIRST_CONTRACT // 첫계약
}

enum CouponStatus {
  HELD     // 보유 — 지급 조건 미충족
  PENDING  // 지급 예정 — 계약 완료, 지급 대기
  PAID     // 지급 완료
  EXPIRED  // 만료
  REVOKED  // 회수(어드민 수동)
}

model CouponPolicy {
  id           String        @id @default(cuid())
  code         String        @unique // "SIGNUP_FUEL_100K" — 코드에서 참조하는 안정 키
  trigger      CouponTrigger
  title        String        // "첫가입 축하 주유권"
  description  String?       // 카드 본문 한 줄
  rewardLabel  String        // "주유권 10만원" (표시용)
  rewardAmount Int?          // 100000 (원, 집계용). 비금액성 리워드는 null
  rewardKind   String        // "FUEL" | "CASH" | "GIFT" 등
  termsNote    String?       // 유의사항
  validDays    Int?          // 발급일 기준 유효일수. null = 무기한
  isActive     Boolean       @default(true)
  startsAt     DateTime?
  endsAt       DateTime?
  displayOrder Int           @default(0)
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt

  coupons IssuedCoupon[]

  @@index([trigger, isActive])
}

model IssuedCoupon {
  id       String       @id @default(cuid())
  userId   String       // Prisma User.id — QuoteDelivery 와 같은 규약
  policyId String
  code     String       @unique // "AD-8F3K2A" 고객 안내·어드민 검색용
  status   CouponStatus @default(HELD)

  // 발급 시점 스냅샷. 정책이 나중에 바뀌어도 고객에게 약속한 내용은 고정된다.
  titleSnapshot        String
  rewardLabelSnapshot  String
  rewardAmountSnapshot Int?

  issuedAt  DateTime  @default(now())
  expiresAt DateTime?

  qualifiedQuoteId String?   // PENDING 으로 만든 SavedQuote.id
  qualifiedAt      DateTime?
  paidAt           DateTime?
  paidBy           String?   // 처리한 어드민 User.id
  paidMemo         String?   // "카카오 상품권 발송 완료"
  revokedAt        DateTime?
  revokeReason     String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user   User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  policy CouponPolicy @relation(fields: [policyId], references: [id])

  @@unique([userId, policyId]) // 중복 발급 원천 차단
  @@index([userId, status])
  @@index([status, issuedAt])
}
```

`User` 모델에 `coupons IssuedCoupon[]` 역방향 필드를 추가한다.

### 스냅샷 컬럼을 두는 이유

어드민이 정책 금액을 10만원에서 5만원으로 낮춰도, 이미 "10만원 드립니다"라고 약속한
회원의 화면은 바뀌면 안 된다. 리워드형 쿠폰에서 이건 분쟁 방지선이다. 표시에는 항상
`*Snapshot` 을 쓰고, `CouponPolicy` 는 신규 발급과 어드민 편집에만 쓴다.

### `@@unique([userId, policyId])` 의 트레이드오프

발급 로직을 몇 번 돌려도 1인 1매가 DB 레벨에서 보장된다. 대신 나중에 "매달 반복 지급"
같은 정책이 필요해지면 이 제약을 `issuanceKey` 기반(`@@unique([userId, issuanceKey])`)
으로 바꾸는 마이그레이션이 필요하다. 첫가입·첫계약은 정의상 1회성이므로 지금은 단순한
쪽을 택한다.

### 금액 단위

`rewardAmount` 는 원 단위 `Int` 다. 부동소수를 쓰지 않는다.

## 발급 엔진

### 채택하지 않은 방식

| | A. 이벤트 훅만 | B. 조회 시 동기화 | C. 크론 배치 |
| --- | --- | --- | --- |
| 즉시성 | 즉시 | 즉시 | 최대 24시간 지연 |
| 호출 지점 누락 | 영구 미발급 | 불가능 | 불가능 |
| 새 정책 추가 시 기존 회원 | 백필 스크립트 필요 | 다음 방문에 자동 수령 | 다음 배치에 자동 |
| 어드민 지급 대기 목록 | 정확 | 회원이 방문해야 생김 | 정확 |

A 는 호출 지점을 하나라도 빠뜨리면 회원이 영구히 쿠폰을 못 받는다. C 는 계약 직후
"지급 예정"이 안 보여 고객 체감이 나쁘다. B 단독은 회원이 쿠폰함에 들어오지 않으면
`PENDING` 행이 생기지 않아 딜러가 지급 대상을 모른다.

### 채택: B + 훅 1개

판정 로직과 DB 접근을 분리한다. 판정은 순수 함수라 prisma 목 없이 테스트한다.

- `src/lib/coupons/rules.ts` — `planCouponReconcile(input)`. DB를 모른다. 입력은 정책·
  보유 쿠폰·계약 여부·현재 시각, 출력은 "무엇을 발급/전이/만료할지"의 계획이다.
- `src/lib/coupons/reconcile.ts` — `reconcileUserCoupons(target, db)`. 읽고, 계획을
  세우고, 적용한다.

```ts
export interface CouponReconcileTarget {
  id: string;              // Prisma User.id
  supabaseId: string;      // SavedQuote.userId 와 대조할 값
  profileCompleted: boolean;
}

export async function reconcileUserCoupons(
  target: CouponReconcileTarget,
  tx?: Prisma.TransactionClient,
): Promise<void>
```

하는 일은 네 가지다.

1. 활성 정책(`isActive = true`, 현재 시각이 `startsAt`~`endsAt` 안) 중 자격을 충족한 것을
   발급한다. `createMany({ skipDuplicates: true })` 로 멱등성을 지킨다.
   정책이 비활성이 되거나 노출 기간이 끝나면 **신규 발급만 멈춘다.** 이미 발급된
   쿠폰은 상태·표시·지급 흐름이 모두 그대로다.
2. 자격이 충족된 `HELD` 를 `PENDING` 으로 올리고 `qualifiedQuoteId`·`qualifiedAt` 을 남긴다.
3. 계약이 철회됐으면 `PENDING` 을 `HELD` 로 되돌린다. `PAID` 는 제외한다.
4. `expiresAt` 이 지난 `HELD` 를 `EXPIRED` 로 바꾼다. `PENDING` 은 만료시키지 않는다 —
   조건을 이미 충족한 쿠폰을 시간 때문에 뺏으면 안 된다.

**발급 조건과 지급 조건은 다르다.** 발급 조건은 "쿠폰함에 카드가 생기는" 기준이고,
지급 조건은 "`PENDING` 으로 올라가는" 기준이다.

| trigger | 발급 조건 (카드 생성) | 지급 조건 (`PENDING` 전이) |
| --- | --- | --- |
| `SIGNUP` | `user.profileCompleted === true` | 계약 완료 |
| `FIRST_CONTRACT` | 계약 완료 | 계약 완료 |

계약 완료 = `SavedQuote` 중 `userId = supabaseId`, `status = CONVERTED`, `deletedAt = null`
인 행이 1건 이상.

지급 조건은 두 trigger 모두 계약 완료로 같다. 그래서 `SIGNUP` 쿠폰은 가입 직후 `HELD`
로 생겨 계약을 기다리고, `FIRST_CONTRACT` 쿠폰은 발급 조건과 지급 조건이 동시에
충족되므로 **처음부터 `PENDING` 으로 생성된다.**

`SIGNUP` 발급을 카카오 로그인 직후가 아니라 `profileCompleted` 시점으로 잡는 이유는,
그 전에는 이름·전화가 없어 연락이 불가능한 유령 계정일 수 있기 때문이다.

호출 지점은 세 곳이다.

| 위치 | 시점 |
| --- | --- |
| `getCouponBoxData()` | 쿠폰함 진입 |
| `getMyPageData()` | 마이페이지 진입 (요약 카드 정확도) |
| `src/app/api/admin/quotes/[id]/route.ts` | `status` 가 `CONVERTED` 로 바뀌는 트랜잭션 안 |

세 번째가 B 단독의 유일한 실질 결함을 없앤다. `CONVERTED` 전이는 코드 전체에서 이 한
곳(41행)뿐이라 훅 비용이 작다. 나중에 크론이 필요해지면 같은 함수를 전수로 돌린다.

### userId 규약 (중요)

이 코드베이스는 `userId` 가 두 종류다.

- `SavedQuote.userId` = **Supabase auth user id**. `requireMember()` 가 주는 `access.userId`
- `QuoteDelivery.userId` = **Prisma `User.id`**

`IssuedCoupon` 은 `User` 릴레이션이 필요하므로 후자를 쓴다. 그래서 계약 여부 조회는
`supabaseId` 로, 쿠폰 조회·생성은 `User.id` 로 해야 한다. 이걸 헷갈리면 "발급은 되는데
계약해도 지급 예정으로 안 넘어가는" 조용한 버그가 난다.

`reconcileUserCoupons` 가 `CouponReconcileTarget` 객체를 받는 이유가 이것이다. 문자열
하나를 받으면 호출부에서 어느 id 인지 헷갈릴 여지가 남는다.

### 쿠폰 코드 생성

`crypto.randomBytes` 기반 base32 8자에 `AD-` 접두어를 붙인다(`AD-8F3K2A`). 혼동 문자
(`I`, `O`, `0`, `1`)는 제외한다. 권한이 없는 식별자지만 순번 노출은 피한다.

## 화면

### `/mypage/coupons`

```
쿠폰함
┌─────────────┬─────────────┬─────────────┐
│ 보유 1장     │ 지급 예정 1장 │ 받을 혜택 40만원│   ← 요약 스트립
└─────────────┴─────────────┴─────────────┘
사용 가능
  [PENDING 쿠폰 카드]   ← 지급 예정이 항상 먼저
  [HELD 쿠폰 카드]
지난 쿠폰 ▸                                  ← <details> 기본 접힘
  [PAID / EXPIRED / REVOKED]
유의사항 박스
```

`사용 가능` 은 `PENDING` + `HELD`, `지난 쿠폰` 은 `PAID` + `EXPIRED` + `REVOKED` 다.
요약 스트립의 "보유"는 `HELD` 장수, "지급 예정"은 `PENDING` 장수다.

쿠폰이 하나도 없으면 기존 `src/components/ui/EmptyState.tsx` 를 쓰고 `/cars` CTA 를 단다.

필터 탭은 넣지 않는다. 쿠폰이 2~3장인 초기에는 빈 탭만 만든다. 종류가 늘면 그때 붙인다.

"받을 혜택" 총액은 `HELD` + `PENDING` 의 `rewardAmountSnapshot` 합이다. **"계약 완료 시
지급" 문구를 반드시 병기한다.** 조건 없이 금액만 크게 보이면 표시광고 문제가 된다.

### 쿠폰 카드

실물 티켓 은유를 쓴다. 좌측 스텁(리워드 아이콘 + 금액) / 절취선 / 우측 본문(상태 칩,
제목, 안내 문구, 쿠폰 코드). 견적 카드(사각형 + 썸네일)와 형태가 확실히 달라 같은
영역에 섞여도 구분된다.

상태별 토큰 매핑:

| 상태 | 스텁 | 테두리 | 상태 칩 | 의도 |
| --- | --- | --- | --- | --- |
| `PENDING` | `bg-brand` + 흰 텍스트 | `border-brand/25`, `shadow-card-hover` | `bg-status-warning-soft text-status-warning` | 페이지의 주인공. 곧 받는다는 감각 |
| `HELD` | `bg-brand-soft text-brand` | `border-border-subtle` | `bg-surface-soft text-text-body` | 조건 미충족. 계약 유인 |
| `PAID` | `bg-status-positive-soft text-status-positive` | `border-border-subtle` | `bg-status-positive-soft` + 지급일 | 죽이되 성취감은 남김 |
| `EXPIRED` / `REVOKED` | `bg-surface-soft text-text-muted` | `border-border-subtle` | `bg-surface-soft text-text-muted` | 접힌 "지난 쿠폰" 안에만 |

절취선의 위아래 반원 노치는 `mask-image` 에 `radial-gradient` 두 개를
`mask-composite: intersect` 로 겹쳐 실제 구멍을 뚫는다. 배경색 원을 덧대는 방식은 섹션
배경이 바뀌면 티가 나서 쓰지 않는다. `mask` 를 쓰면 `box-shadow` 가 잘리므로 그림자
대신 내부 `ring` 으로 처리한다.

스텁 아이콘은 `rewardKind` 로 고른다(lucide-react). `FUEL` → `Fuel`, `CASH` → `Wallet`,
`GIFT` → `Gift`, 그 외/미매칭 → `Ticket`. 매핑은 `src/constants/coupon.ts` 에 두고,
모르는 값이 와도 기본 아이콘으로 떨어지게 한다.

데스크톱 2열, 모바일 1열이다. 기존 견적 카드 그리드와 같은 `md:grid-cols-2` 를 쓴다.

### `/mypage` 허브화

`src/app/(member)/mypage/layout.tsx` 는 현재 `profileCompleted` 가드 14줄뿐이다. 여기에
상단 탭 내비게이션(`홈` / `쿠폰함`)을 넣는다.

데스크톱 사이드바가 아니라 상단 탭인 이유는 현재 `max-w-[960px]` 단일 컬럼 구조를 깨지
않고, 모바일과 같은 패턴을 쓸 수 있어서다.

`SegmentedControl` 컴포넌트는 쓰지 않는다. `role="radiogroup"` 이라 페이지 이동에는 맞지
않다. 같은 시각 스타일(`bg-surface-soft` 트랙 + 활성 `bg-surface shadow-card`)을 쓰되
`<nav>` + `<Link>` 로 만들고 활성 항목에 `aria-current="page"` 를 준다.

메인 페이지에는 진행 중 견적 카드 아래에 쿠폰 요약 한 줄을 넣는다. 지급 예정이 있으면
`brand` 로 강조하고, 없으면 담백하게 보유 장수만 보여준 뒤 `/mypage/coupons` 로 링크한다.

### 파일 분리

`src/app/(member)/mypage/page.tsx` 는 477줄이고 컴포넌트 7개가 한 파일에 있다. 여기에
섹션을 계속 붙일 거라면 지금이 쪼갤 시점이다.

| 이동 | 대상 |
| --- | --- |
| `src/components/mypage/ActiveQuoteSection.tsx` | `ActiveQuoteSection`, `ProgressSteps`, `Metric` |
| `src/components/mypage/QuoteCard.tsx` | `QuoteCard`, `StatusPill` |
| `src/components/mypage/ProfileSummary.tsx` | `ProfileSummary`, `ProfileRow`, `maskPhone`, `maskEmail` |

`getQuoteHref`·`getExpiryLabel`·`getDeliveryLabel`·`formatMileage` 는
`src/lib/member-queries/mypage-format.ts` 로 뺀다. 동작은 그대로 두고 위치만 옮긴다.

## 어드민

`/admin/coupons` 에 탭 2개를 만든다. `src/components/admin/AdminSidebar.tsx` 에 항목을
추가한다.

**정책 탭** — `CouponPolicy` CRUD. `/admin/memo` + `/api/admin/memos` 의 CRUD 패턴을
따른다. `trigger` 는 생성 후 변경 불가로 둔다(이미 발급된 쿠폰의 자격 판정이 뒤집힌다).

**발급 현황 탭** — `IssuedCoupon` 목록. 기본 필터는 `PENDING`(= 지급해야 할 것). 회원명·
전화·쿠폰 코드로 검색한다. "지급 완료 처리" 버튼 → 메모 입력 → `PAID`.

API 는 `src/app/api/admin/coupons/` 아래에 둔다.

| 라우트 | 메서드 | 권한 |
| --- | --- | --- |
| `/api/admin/coupons/policies` | GET, POST | `requireRoleAtLeast("admin")` |
| `/api/admin/coupons/policies/[id]` | PATCH, DELETE | `requireRoleAtLeast("admin")` |
| `/api/admin/coupons/issued` | GET | `requireRoleAtLeast("staff")` |
| `/api/admin/coupons/issued/[id]/pay` | POST | `requireRoleAtLeast("staff")` |

정책 편집은 금액을 바꾸는 행위라 `admin` 이상으로 제한한다. 지급 처리는 영업 실무라
`staff` 부터 허용한다.

지급 처리는 트랜잭션 안에서 상태 가드(`PENDING → PAID` 만 허용)를 걸고 `AdminAuditLog`
에 기록한다. 이미 `PAID` 인 건에 다시 요청이 오면 409 를 준다.

정책 삭제는 발급본이 있으면 막고 `isActive = false` 를 안내한다.

## 회원 API

쿠폰함은 서버 컴포넌트에서 직접 조회한다. 별도 REST 엔드포인트를 만들지 않는다. 견적
목록이 이미 이 방식이고, 클라이언트에서 쿠폰을 조작할 일이 없다.

`src/lib/member-queries/coupons.ts` 에 `getCouponBoxData(supabaseId)` 를 두고
`requireMember()` 로 얻은 본인 id 로만 호출한다.

## 검증과 에러 처리

- 정책 입력은 zod 로 검증한다. `rewardAmount >= 0`, `validDays >= 1`,
  `endsAt > startsAt`, `code` 는 `^[A-Z0-9_]{3,40}$`.
- `reconcileUserCoupons` 가 실패해도 페이지 렌더는 막지 않는다. `console.error` 로 남기고
  기존 쿠폰 목록을 그대로 보여준다. 동기화 실패가 마이페이지 전체를 죽이면 안 된다.
- 지급 처리 실패는 사용자에게 한국어 메시지로 돌려주고 상세는 서버 로그에만 남긴다.

## 초기 정책 시드

마이그레이션에 정책 2건을 넣는다. 금액과 문구는 어드민에서 수정한다.

| code | trigger | title | rewardLabel | rewardAmount | validDays |
| --- | --- | --- | --- | --- | --- |
| `SIGNUP_FUEL_100K` | `SIGNUP` | 첫가입 축하 주유권 | 주유권 10만원 | 100000 | 90 |
| `FIRST_CONTRACT_CASH_300K` | `FIRST_CONTRACT` | 첫계약 축하금 | 축하금 30만원 | 300000 | null |

## 테스트

`reconcileUserCoupons` 가 로직의 전부라 여기에 집중한다.
`src/lib/member-queries/mypage.test.ts` 의 vitest 패턴을 따른다.

- `profileCompleted` false → 발급 없음
- `profileCompleted` true → `SIGNUP` 쿠폰 1매, 상태 `HELD`
- 두 번 호출해도 1매 (멱등성)
- `CONVERTED` 견적 존재 → `HELD` 가 `PENDING` 으로, `FIRST_CONTRACT` 쿠폰도 발급
- `expiresAt` 경과한 `HELD` → `EXPIRED`. `PENDING` 은 만료되지 않음
- 계약 철회 → `PENDING` 이 `HELD` 로. `PAID` 는 불변
- 비활성 정책 → 신규 발급 없음. 기존 발급본은 그대로 조회됨
- 스냅샷: 발급 후 정책 금액을 바꿔도 `rewardAmountSnapshot` 불변

API 통합 테스트:

- 타인 쿠폰 조회 차단
- 지급 처리 권한(`member` 거부) 및 상태 가드(`HELD` 에 지급 요청 시 409)

E2E(playwright) 1개: 가입 → 마이페이지 → 쿠폰함에 첫가입 쿠폰 노출.

## 마이그레이션

`prisma migrate dev` 가 셰도우 DB 재생성에 실패하는 환경이므로 `db execute` +
`migrate resolve` 수기 절차를 따른다.

## 구현 순서

1. 스키마 + 마이그레이션 + 시드
2. `src/lib/coupons/` (코드 생성, `reconcileUserCoupons`) + 단위 테스트
3. `src/lib/member-queries/coupons.ts`
4. `/mypage` 파일 분리 + `layout.tsx` 탭 내비
5. `/mypage/coupons` 페이지 + 쿠폰 카드 컴포넌트
6. `/mypage` 요약 카드
7. `CONVERTED` 훅
8. 어드민 API + 화면
9. E2E
