# Public Mobile UI System

아임딜러 공개 화면의 모바일 개편 기준이다. 목표는 기존 메인 컬러 `#000666`을 유지하면서, 심플하고 신뢰감 있는 금융 앱 톤으로 차량 탐색부터 견적 결과까지 이어지는 경험을 통일하는 것이다.

## 적용 범위

- 적용: `/cars`, `/cars/[slug]`, `/quote`, 이후 `/recommend`, `/verify` 모바일 화면
- 제외: 어드민 화면, 견적 계산 로직, API payload, Prisma schema, 시드 데이터
- 우선순위: 기능 흐름 보존 > 금융 정보 가독성 > 앱형 조작감 > 장식적 표현

## Color Tokens

| 역할 | 값 | 사용처 |
| --- | --- | --- |
| Primary | `#000666` | 주요 CTA, 진행 상태, 핵심 금액 강조 |
| App background | `#F5F6FA` | 공개 모바일 화면 배경 |
| Surface | `#FFFFFF` | 카드, 섹션, 플로팅 CTA |
| Border | `#E7EAF2` | 카드 경계, 분리선, 보조 버튼 |
| Muted text | `#6F7590` | 보조 설명, 라벨, 메타 정보 |
| Trust tint | `#EEF2FF` | 신뢰/안내/강조 배경 |

## Layout Rules

- 모바일 페이지는 `public-app-page`를 기본 배경으로 사용한다.
- 주요 정보 묶음은 `public-mobile-section`, 반복 카드에는 `public-mobile-card`를 사용한다.
- 고정 CTA는 `public-fixed-action`을 사용하고 safe-area inset을 반드시 포함한다.
- 차량 상세처럼 하단 네비게이션과 CTA가 공존하는 화면은 `public-floating-action-shell`을 사용해 네비게이션과 시각적으로 분리한다.
- 카드 안의 카드 중첩은 피한다. 필요하면 같은 카드 안에서 분리선, tint 영역, 칩으로 정보 구획을 만든다.
- 모바일 화면에서 문서 가로 overflow는 0이어야 한다. 가로 스크롤은 필터, 추천 카드 캐러셀처럼 의도된 영역에만 허용한다.

## Typography

- 금융 숫자는 `public-finance-number`를 사용하고 tabular number를 유지한다.
- 섹션 라벨은 `public-quiet-label`을 사용한다.
- 버튼/칩/카드 내부 텍스트는 11-15px 범위에서 유지하고, 히어로급 크기는 첫 화면 제목과 핵심 월 납입금에만 사용한다.
- 이모지와 과한 감탄형 문구는 피한다. 친절하지만 가볍지 않은 톤을 유지한다.

## Component Guidance

### Header / Bottom Nav

- 모바일 헤더는 50px 수준의 앱바 밀도로 유지한다.
- 바텀 네비게이션 아이콘은 추상적 그림보다 기능을 바로 떠올릴 수 있는 아이콘을 사용한다.
- `/quote`처럼 집중 플로우가 필요한 화면에서는 바텀 네비게이션을 숨긴다.

### Vehicle Cards

- 차량명, 월 납입금, 기준 조건, CTA가 한눈에 보여야 한다.
- 월 납입금은 오른쪽 또는 하단 CTA 근처에 고정된 계층으로 둔다.
- 카드 전체가 너무 마케팅 배너처럼 보이지 않도록 장식보다 정보 밀도를 우선한다.

### Quote Flow

- 단계 이동과 API 호출 핸들러는 기존 흐름을 유지한다.
- Step 2 CTA는 사용자가 얻는 결과를 드러내는 문구를 우선한다. 예: `월 납입금 확인하기`
- 결과 CTA는 신청 행위를 과장하지 않고 조건 기준으로 표현한다. 예: `이 조건으로 심사 요청하기`
- 결과 화면의 보조 문구는 안심 요소를 짧게 제공한다. 예: `연락처 입력 전 상담 가능`, `최종 조건 상담 후 확정`

## QA Checklist

- 360px, 390px, 430px 폭에서 `/cars`, `/cars/[slug]`, `/quote` 주요 단계 스크린샷을 확인한다.
- `documentElement.scrollWidth - innerWidth`가 0인지 확인한다.
- 고정 CTA가 마지막 콘텐츠를 가리지 않는지 확인한다.
- `src/lib/quote-calculator.ts`, `prisma/seed.ts`, `src/app/(admin)`, `src/components/admin` 변경이 없는지 확인한다.
- `pnpm exec tsc --noEmit`, `pnpm run build`, `pnpm exec vitest run --exclude '.claude/**'`, `pnpm exec eslint . --ignore-pattern '.claude/**'`를 실행한다.
