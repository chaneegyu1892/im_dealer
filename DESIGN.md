# Design System — 아임딜러

> **[AI Agent 참고]**
> 모든 컴포넌트는 이 문서의 디자인 시스템을 100% 준수해서 구현한다.
> Tailwind CSS 커스텀 토큰은 이 파일의 색상값을 기준으로 설정한다.

---

## Color Palette

### Primary

- Base: `#000666` (Deep Navy)
- Shades: `#000999`, `#0010CC`, `#3333CC`, `#6666DD`, `#9999EE`, `#CCCCF5`, `#E5E5FA`

### Secondary

- Base: `#71749A` (Muted Slate Blue)
- Shades: `#4A4D70`, `#5A5D80`, `#8185AA`, `#9196BB`, `#B0B4CC`, `#D0D3E5`, `#E8EAF2`

### Tertiary

- Base: `#5C1800` (Deep Burgundy / Dark Red)
- Shades: `#7A2000`, `#992800`, `#BB3300`, `#CC5533`, `#DD8866`, `#EEBBAA`, `#F5DDD5`

### Neutral

- Base: `#F8F9FA` (Off White / Light Gray Background)
- Shades: `#E0E0E0`, `#C0C0C0`, `#A0A0A0`, `#606060`, `#404040`, `#202020`, `#000000`

### Semantic

- Success: `#E5E5FA` (bg) / `#000666` (text)
- Error: `#FFEBEB` (bg) / `#CC0000` (text)
- Destructive: `#CC0000`

---

## Typography

Font: **Inter** (fallback: system-ui, -apple-system, sans-serif)

| Role     | Size    | Weight        | Color     |
| -------- | ------- | ------------- | --------- |
| Headline | 28–40px | Light (300)   | `#1A1A1A` |
| Title    | 18–24px | Medium (500)  | `#1A1A1A` |
| Body     | 15–16px | Regular (400) | `#404040` |
| Label    | 12–13px | Regular (400) | `#71749A` |
| Caption  | 11–12px | Regular (400) | `#A0A0A0` |

- Line height: `1.5–1.7` (relaxed)
- Letter spacing: default (no tight tracking)

---

## Buttons

| Variant   | Background  | Text      | Border              |
| --------- | ----------- | --------- | ------------------- |
| Primary   | `#000666`   | `#FFFFFF` | none                |
| Secondary | `#F8F9FA`   | `#000666` | `1px solid #E0E0E0` |
| Inverted  | `#1A1A2E`   | `#FFFFFF` | none                |
| Outlined  | transparent | `#000000` | `1px solid #000`    |

- Border radius: `8px`
- Padding: `12px 24px`
- Font weight: Medium (500)
- Hover: 10% opacity overlay
- Disabled: opacity `0.4`

---

## Form Elements

### Search Input

- Background: `#FFFFFF`
- Border: `1px solid #E0E0E0`
- Border radius: `8px`
- Placeholder: `#A0A0A0`
- Icon: search icon left, `#A0A0A0`
- Padding: `12px 16px 12px 40px`
- Focus border: `1px solid #000666`

### Select / Dropdown

- 동일한 스타일 기준 적용
- 화살표 아이콘: `#71749A`

---

## Cards & Containers

### 기본 카드

- Background: `#FFFFFF`
- Border: `1px solid #F0F0F0`
- Border radius: `12px`
- Shadow: `0 2px 8px rgba(0,0,0,0.06)`
- Padding: `16px–24px`

### 카드 Hover 상태

- Shadow: `0 8px 24px rgba(0,6,102,0.12)`
- Border: `1px solid #CCCCF5`
- Transform: `translateY(-2px)`
- Transition: `all 0.2s ease`

### 추천 카드 (강조)

- Border: `2px solid #000666`
- 나머지는 기본 카드와 동일

---

## Hero Section

메인 랜딩 상단 전면 배치 컴포넌트

- Background: `linear-gradient(135deg, #000666 0%, #1A1A6E 60%, #3333CC 100%)`
- Border radius: `16px`
- Padding: `40px 32px`
- 배경 원형 장식: `rgba(255,255,255,0.08)`, 위치 자유
- Tag pill: `rgba(255,255,255,0.15)` bg, `rgba(255,255,255,0.9)` text, border-radius `20px`
- Headline: `font-size 28px`, `font-weight 300`, white
- Subtext: `rgba(255,255,255,0.7)`
- CTA 버튼: 흰 배경 + Primary 텍스트 (Inverted Primary)

---

## Step Indicator

AI 추천 4단계 플로우 진행 표시

### 스텝 상태

| 상태   | Background | Text      | 추가 효과                                  |
| ------ | ---------- | --------- | ------------------------------------------ |
| 완료   | `#000666`  | `#FFFFFF` | 체크 아이콘                                |
| 현재   | `#000666`  | `#FFFFFF` | `box-shadow: 0 0 0 4px rgba(0,6,102,0.15)` |
| 미완료 | `#E0E0E0`  | `#A0A0A0` | none                                       |

### 연결선

- 완료 구간: `#000666`, `height: 2px`
- 미완료 구간: `#E0E0E0`, `height: 2px`

### 스텝 라벨

- Font size: `11px`
- Color: `#71749A`
- Position: 원형 아래 중앙 정렬

### 스텝 목록

1. 업종 (업종/사업형태)
2. 목적 (차량 사용 목적)
3. 예산 (예산 범위 및 납입 성향)
4. 성향 (주행거리 및 인수/반납 성향)

---

## Skeleton Loading

AI 추천 결과 로딩 중 표시 컴포넌트

- Background: `linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)`
- Animation: shimmer (좌→우 슬라이드), `1.4s infinite`
- Border radius: `6px`
- 카드 내부 구성:
  - 제목 라인: `height 16px`, `width 60%`
  - 부제목 라인: `height 12px`, `width 40%`
  - 가격 라인: `height 32px`, `width 50%`
  - 하단 버튼: `height 40px`, `width 100%`, `border-radius 8px`

---

## Tab Component

견적 시나리오 (보수형 / 표준형 / 공격형) 전환용

### 탭 바

- Border bottom: `1px solid #E0E0E0`

### 탭 아이템

| 상태   | Text color | Border bottom       |
| ------ | ---------- | ------------------- |
| 활성   | `#000666`  | `2px solid #000666` |
| 비활성 | `#A0A0A0`  | none                |

- Padding: `10px 20px`
- Font size: `14px`, weight `500`

### 견적 시나리오 카드 (탭 내부)

| 시나리오 | 특징                                        |
| -------- | ------------------------------------------- |
| 보수형   | 보증금 있음, 월납입 낮음                    |
| 표준형   | 보증금 없음, 균형 잡힌 조건 — **기본 추천** |
| 공격형   | 선납금 있음, 월납입 가장 낮음               |

- 추천 시나리오(표준형): `border: 2px solid #000666`
- 일반 시나리오: `border: 1px solid #E0E0E0`

---

## Trust Badges

신뢰 요소 — 화면 내 자연스럽게 배치

- Background: `#E5E5FA`
- Text color: `#000666`
- Border radius: `20px` (pill)
- Padding: `6px 14px`
- Font size: `13px`, weight `500`
- 체크 아이콘: `#000666` 원형 bg, white 아이콘, `16px`

### 기본 배지 목록

- ✓ 허위견적 없음
- ✓ 개인정보 없이 견적 확인
- ✓ 상담 압박 없음

---

## Tooltip

견적 관련 어려운 용어 설명용 (잔존가치, 선납금 등)

### 트리거

- 원형 `18px`, background `#E0E0E0`, text `#71749A`
- 내용: `?`

### 툴팁 박스

- Background: `#1A1A2E`
- Text color: `#FFFFFF`
- Font size: `12px`
- Padding: `8px 12px`
- Border radius: `8px`
- Width: `180px`
- 꼬리: 아래 방향 삼각형, `#1A1A2E`
- Position: 트리거 위쪽 중앙

---

## Empty State

추천 결과 없음, 데이터 없음 등 빈 상태 화면

- 아이콘 원형: `56px`, background `#E5E5FA`
- Title: `16px`, weight `500`, `#1A1A1A`
- Subtitle: `13px`, `#71749A`, 중앙 정렬
- CTA 버튼: Primary 버튼 스타일

### 케이스별 문구

| 케이스    | Title                | Subtitle                                           |
| --------- | -------------------- | -------------------------------------------------- |
| 추천 없음 | 추천 결과가 없어요   | 조건을 조금 바꿔보면 더 많은 차량을 찾을 수 있어요 |
| 차량 없음 | 등록된 차량이 없어요 | 관리자 페이지에서 차량을 추가해주세요              |

---

## Toast Messages

운영자 관리 페이지 및 사용자 액션 피드백

| 타입 | Background | Text color | 아이콘 |
| ---- | ---------- | ---------- | ------ |
| 성공 | `#E5E5FA`  | `#000666`  | ✓      |
| 오류 | `#FFEBEB`  | `#CC0000`  | !      |

- Border radius: `10px`
- Padding: `14px 18px`
- Font size: `14px`, weight `500`
- 위치: 화면 우측 하단 또는 상단 중앙
- 자동 사라짐: `3초`

---

## Progress / Divider Lines

- Primary: `#000666`
- Secondary: `#71749A`
- Tertiary: `#5C1800`
- Height: `2–3px`
- Border radius: `2px`

---

## Icons & Navigation

### Top Navigation (웹)

- Background: `#FFFFFF`
- Border bottom: `1px solid #F0F0F0`
- Logo: Primary `#000666`
- 메뉴 링크: `#404040`, hover `#000666`

### Bottom Navigation (모바일)

- Active: 원형 bg `#000666`, white 아이콘
- Inactive: bg 없음, `#A0A0A0`
- Icon size: `24px`
- Nav items: 홈, 탐색, 마이페이지

### Action Icons (FAB)

| 용도         | Color     |
| ------------ | --------- |
| Primary 액션 | `#000666` |
| 수정         | `#5C1800` |
| 태그/라벨    | `#71749A` |
| 삭제         | `#CC0000` |

- Shape: 원형 `48px`
- Icon color: `#FFFFFF`

---

## Layout & Spacing

- Page background: `#F8F9FA`
- Base unit: `8px`
- Component gap: `16px`
- Section gap: `24px–32px`
- Max content width: `1200px`
- Mobile breakpoint: `768px`

---

## Animation & Transition

- 기본 전환: `transition: all 0.2s ease`
- 카드 hover lift: `transform: translateY(-2px)`
- 스켈레톤 shimmer: `1.4s infinite linear`
- 스텝 활성 펄스: `box-shadow 0 0 0 4px rgba(0,6,102,0.15)`
- 토스트 등장: `fadeIn 0.2s ease`

---

## Design Principles

- **Clean & minimal**: 중립 배경, 흰 카드, 넉넉한 여백
- **Navy-first**: Primary가 CTA, 활성 상태, 핵심 UI 지배
- **Burgundy accent**: 3차 액션, 파괴적 상태에만 제한적 사용
- **Slate secondary**: 보조 텍스트, 비활성 상태, 2차 액션
- **Consistent radius**: 모든 인터랙티브 요소 `8–12px`
- **Trust through transparency**: 정보가 숨겨지지 않고 투명하게 보이는 구조
- **No pressure UI**: 상담 압박, 개인정보 강요 없는 구조
