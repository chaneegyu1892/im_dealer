# 야간 /loop 자율 실행 작업 목록

**작성일:** 2026-05-15
**기반 문서:** `.planning/ui-tasks-20260515.md`
**범위:** 🟢 항목 16개 (5개 묶음)
**실행:** `/loop .planning/loop-tasks-20260515.md`

---

## 🚨 /loop 실행 시 절대 규칙

1. **각 작업 완료 후 반드시 `npm run build` 통과 확인** — 실패 시 거기서 멈춤
2. **Prisma schema(`prisma/schema.prisma`) 수정 금지** — 만나면 멈춤
3. **마이그레이션 명령(`prisma migrate`) 실행 금지** — 만나면 멈춤
4. **`src/lib/quote-calculator.ts` 수정 금지** (CLAUDE.md 규칙)
5. **추천 점수 로직(`src/lib/recommend-*.ts`) 변경 시 신중 — 변경 후 추천 결과 정상 산출 확인**
6. **각 작업 완료마다 별도 커밋** — 묶음으로 한 번에 커밋하지 말 것
7. **작업 의도가 명확하지 않으면 멈춤** — 추측으로 진행 금지
8. **`--no-verify` 금지** — pre-commit hook 우회 금지

커밋 메시지 포맷:
```
feat: <작업 번호와 제목>

<상세 내용>
```

---

## 묶음 A — 옵션 데이터 단순 변경 (가장 안전)

### A-1. 3.4 예산 옵션 6단계 → 3단계 🟢

**파일:**
- `src/constants/recommend-options.ts:50-56` (BUDGET_RANGES 배열)
- `src/components/recommend/StepBudget.tsx` (예산 UI에서 옵션 참조)

**현재:**
```
30만원 이하 / 30~50 / 50~70 / 70~100 / 100~150 / 150 이상
```

**변경:**
```
50만원 이하 / 50~100만원 / 100만원 이상
```

**주의:**
- BUDGET_RANGES의 `value`/`min`/`max` 필드명을 유지 (다른 파일에서 참조 가능성)
- 추천 점수 로직(`src/lib/recommend-score.ts` 등)에서 BUDGET_RANGES `value` 문자열을 참조하면 영향. **반드시 확인 후 변경**

**검증:**
- `npm run build` 통과
- `npm run dev` → `http://localhost:3000/recommend` → 예산 단계 진입 → 옵션 3개만 보임
- 각 옵션 선택 후 다음 단계로 진행 가능

**커밋:** `feat(recommend): 예산 옵션 6단계 → 3단계로 축소`

---

### A-2. 3.6 주행거리 4개 → 3개 + 라벨 변경 🟢

**파일:** `src/constants/recommend-options.ts:80-85` (MILEAGE_OPTIONS)

**현재:** `연 2만km 이하 / 2~3만 / 3~4만 / 4만 이상`

**변경:**
- `연 1만km` — "적게 타요 (연 1만km)"
- `연 2만km` — "적당히 타요 (연 2만km) ← 80% 고객 선택" **(기본값/추천 배지)**
- `연 3만km` — "정말 많이 타는 편이에요 (연 3만km)"

**추가 UI:**
- 주행거리 단계 컴포넌트(`StepPreference.tsx` 또는 분리된 단계)에 평균 통계 안내 박스:
  > "📊 80%의 고객이 연 2만km를 선택해요"

**주의:**
- 추천 점수 로직에서 MILEAGE_OPTIONS `value` 참조 시 호환 유지
- 기본값(default) 표시 방식이 UI에 이미 있는지 확인 후, 없으면 별도 prop이나 클래스로 강조

**검증:**
- `npm run build` 통과
- `/recommend` → 주행거리 단계 → 3개 옵션, "적당히 타요"에 강조 배지, 통계 박스 보임

**커밋:** `feat(recommend): 주행거리 옵션 3개로 축소 + 라벨/통계 안내`

---

### A-3. 3.7 연료 방식 라벨 정리 + 안내 메시지 🟢

**파일:** `src/constants/recommend-options.ts:188-193` (FUEL_OPTIONS)

**현재:** `상관없음 / 전기차 선호 / 하이브리드 선호 / 가솔린·디젤 선호`

**변경 라벨:** `전기차 / 하이브리드 / 내연기관 / 상관없음` (순서도 변경)

**추가:**
- 연료 단계 UI에 안내 메시지 (선택에 따른 조건 안내):
  - 전기차 선택 + 예산 50만원 이하: "전기차는 예산이 더 필요할 수 있어요"
  - 그 외 케이스는 안내 없음
- 이 안내는 클라이언트 사이드 조건문으로 충분 (state 기반)

**주의:**
- value 필드(예: `ev`, `hybrid`, `ice`, `any`)는 변경 금지 — 추천 점수에서 참조 중일 수 있음
- 라벨/순서만 변경

**검증:**
- `npm run build` 통과
- `/recommend` → 연료 단계 → 새 라벨 4개
- 예산 50만원 이하 + 전기차 선택 시 안내 메시지 노출

**커밋:** `feat(recommend): 연료 방식 라벨 정리 + 예산-연료 안내 메시지`

---

### A-4. 3.8 계약 종료 방식 질문 삭제 🟢

**파일:**
- `src/constants/recommend-options.ts:195-214` (END_TYPE_OPTIONS)
- `src/components/recommend/StepPreference.tsx:66-88` (UI 블록)
- `src/components/recommend/RecommendFlow.tsx` (FlowState에서 `endType` 또는 `contractEndType` 필드)
- `src/lib/recommend-*.ts` (점수 계산에서 endType 참조 여부 확인)

**작업:**
1. END_TYPE_OPTIONS 상수 제거
2. StepPreference.tsx의 "계약 종료 후 어떻게 하실 건가요?" 섹션 통째로 제거
3. FlowState에서 endType 필드 제거 + 초기값/setter 정리
4. `src/lib/recommend-score.ts` 등에서 endType 가중치 로직 제거 (있다면)
5. API 요청 payload에서도 제거 (있다면)

**검증:**
- `npm run build` 통과
- `/recommend` → preference 단계에서 계약 종료 질문 없음
- 추천 결과 정상 산출
- 콘솔/네트워크에 endType 참조 에러 없음

**커밋:** `refactor(recommend): 계약 종료 방식 질문 제거 (반납/인수 모두 선택형이라 불필요)`

---

## 묶음 B — 결과 페이지 UI 변경

### B-5. 4.3 결과 카드 버튼 강조 반전 🟢

**파일:** `src/components/recommend/RecommendVehicleCard.tsx:215-228`

**현재:**
- "견적내기": 테두리 버튼 (`border-primary/30`)
- "상담하기"(ChannelTalkButton): 진한 배경 (`#1A1A2E`)

**변경:**
- "견적내기": **진한 배경 `#000666` (메인 브랜드 컬러)** + 폰트 크게/굵게
- "상담하기": 테두리/투명 (보조)
- 버튼 크기 비율: 견적내기 > 상담하기

**주의:**
- ChannelTalkButton 컴포넌트가 prop으로 variant를 받는지 확인. 없으면 wrapper 스타일로 처리
- 어드민 UI 색상(`#000666`)이 메인 브랜드 컬러임을 유지 (CLAUDE.md)

**검증:**
- `/recommend` 끝까지 진행 → 결과 카드에서 견적내기 버튼이 시각적으로 더 강조됨
- 모바일 반응형에서도 깨지지 않음

**커밋:** `feat(recommend): 결과 카드 견적/상담 버튼 강조도 반전`

---

### B-6. 4.2 차량 이미지 fallback (imageUrls 활용) 🟢

**파일:** `src/components/recommend/RecommendVehicleCard.tsx:97-108`

**현재:**
```ts
detail.thumbnailUrl ? <Image src={detail.thumbnailUrl} ... /> : <span>🚗</span>
```

**변경:**
```ts
const imageSrc = detail.thumbnailUrl ?? detail.imageUrls?.[0] ?? null;
imageSrc ? <Image src={imageSrc} ... /> : <span>🚗</span>
```

**주의:**
- `RecommendedVehicle` 타입에 `imageUrls` 필드가 있는지 확인. 없으면 `detail` 객체의 origin 타입(Vehicle)에서 가져와야 함
- API 응답(`/api/recommend`)에서 imageUrls를 포함시켜야 할 수 있음 — `src/lib/recommend-*.ts` 또는 API route 확인
- imageUrls가 응답에 없으면 그냥 추가 작업 멈추고 알림

**검증:**
- thumbnailUrl 없는 차량에도 imageUrls의 첫 이미지 표시
- 둘 다 없으면 🚗 이모지 유지
- `npm run build` 통과

**커밋:** `feat(recommend): 차량 이미지 fallback에 imageUrls 활용`

---

### B-7. 4.2 옵션 칩 UI 명확화 🟢

**파일:** `src/components/recommend/RecommendVehicleCard.tsx:134-198` (popularConfigs 렌더링 블록)

**변경:**
1. 옵션 칩에 명확한 클릭 가능 시각 단서:
   - 미선택: 점선 테두리 (`border-dashed`) + hover 시 실선 + 배경 살짝 변화
   - 선택: 진한 배경 + 체크 아이콘 (✓)
2. popularConfigs 섹션 상단에 안내 텍스트:
   > "원하는 옵션을 눌러서 추가해보세요"
3. transition 클래스로 부드러운 상태 변화

**주의:**
- 기존 toggleItem / selectedItems Set 로직은 그대로 유지
- 실시간 금액 계산(`selectedTotal`)도 변경 금지
- Tailwind 클래스만 추가/변경

**검증:**
- 옵션 칩 마우스 hover/선택 시 명확한 시각 피드백
- 클릭 시 금액 변동 그대로 동작
- 모바일 터치에서도 동작 (active: 상태 추가)

**커밋:** `feat(recommend): 결과 카드 옵션 칩 UI 명확화 + 안내 텍스트`

---

## 묶음 C — 메인/인기 차량 UI

### C-8. 2.1 메인 히어로 CTA 순서/스타일 반전 🟢

**파일:** `src/components/home/HeroSection.tsx`

**현재 우측 카드 CTA 2개:**
- 1번: "AI 추천 시작하기" — 흰색 배경(메인), `/recommend`
- 2번: "차량 직접 탐색" — 테두리(보조), `/cars`

**변경:**
- 1번: **"내가 직접 견적 설계하기"** — 진한 배경 `#000666` (메인 강조), `/cars`
- 2번: **"AI가 추천도 해드려요"** — 테두리/투명 (보조), `/recommend`

**유지:**
- 히어로 제목 ("차 뽑기 전에, AI한테 먼저 물어보세요") — 사용자 결정으로 변경 안 함
- 부제목, 배경 이미지(`hero-bg-v2.png`) 유지
- 글래스모피즘 카드 레이아웃 유지

**검증:**
- `/` 접속 → 직접 견적 버튼이 메인 강조 색(`#000666`), AI 버튼이 보조 톤
- 클릭 시 각각 `/cars`, `/recommend`로 이동
- 데스크톱·모바일 모두 정상

**커밋:** `feat(home): 히어로 CTA 순서/강조도 반전 (직접 견적 우선)`

---

### C-9. 2.4 인기 차량 TOP 3 + 더보기 아코디언 🟢

**파일:** `src/components/home/PopularCarsSection.tsx`

**현재:** 6개 차량 카드 항상 3열 그리드로 표시

**변경:**
1. 기본 노출: 처음 3개만
2. 4번째 이상 카드는 `hidden` 상태
3. 하단에 "더 많은 인기 차량 보기" 버튼 추가
   - 클릭 시 4~6번째 카드 펼침 + 버튼 텍스트 "접기"로 변경
   - useState로 토글
4. **계약 조건(60개월/무보증/연2만) 표기는 이번 작업 제외** (데이터 모델 변경 필요)

**주의:**
- 서버 컴포넌트인지 클라이언트 컴포넌트인지 확인. 토글이 필요하면 `'use client'` 추가
- 클라이언트로 전환 시 ISR 영향 검토 (page.tsx는 서버, 섹션만 클라이언트면 OK)

**검증:**
- `/` → 인기 차량 섹션 처음 3개만 보임
- "더 많은 인기 차량 보기" 클릭 → 6개 모두 노출 + 버튼 텍스트 변경
- 다시 클릭 → 3개로 복귀

**커밋:** `feat(home): 인기 차량 TOP 3 노출 + 더보기 토글`

---

## 묶음 D — Accordion + 푸터

### D-10. Accordion UI 컴포넌트 신규 🟢

**파일:** `src/components/ui/Accordion.tsx` (신규)

**요구사항:**
- Headless + Tailwind만 사용 (외부 라이브러리 금지)
- API:
  ```tsx
  <Accordion>
    <AccordionItem title="제목">본문</AccordionItem>
    <AccordionItem title="제목2">본문2</AccordionItem>
  </Accordion>
  ```
- 단일 펼침/다중 펼침 모드 prop으로 제어 (`type="single" | "multiple"`, 기본 multiple)
- 접근성:
  - 헤더 버튼에 `aria-expanded`
  - 키보드: Enter/Space로 토글
  - 패널에 `role="region"`, `aria-labelledby`
- 애니메이션: max-height transition

**주의:**
- `src/components/ui/`의 기존 컴포넌트(Button, Card 등) 스타일 컨벤션 따라가기
- 푸터에서 어두운 배경 위에 쓰이므로 텍스트/테두리 색을 푸터 컨텍스트와 어울리게 변수화

**검증:**
- TypeScript 컴파일 통과
- 다음 작업(D-11)에서 푸터에 적용 후 실제 동작 확인

**커밋:** `feat(ui): Accordion 컴포넌트 신규 추가`

---

### D-11. 2.6 푸터 아코디언 3개 (예시 본문) 🟢

**파일:** `src/components/layout/Footer.tsx`

**추가 위치:** 푸터 상단 네비 섹션 아래, 하단 사업자 정보 위 (또는 사업자 정보 섹션 위쪽)

**아코디언 3개:**

1. **"금융사별 주요 약관"**
   ```
   ※ 본 약관은 추후 업데이트 예정입니다.
   금융사별 상세 약관은 계약 진행 시 별도 안내드립니다.
   ```

2. **"모집인 정보"**
   ```
   영업 총괄: 오영택, 신준호
   (그 외 모집인 정보는 추후 업데이트 예정)
   ※ 모집인 등록번호 및 자세한 정보는 차후 명시됩니다.
   ```

3. **"중도해지 수수료 등 법적 고지"**
   ```
   장기렌트 및 리스 상품은 중도해지 시 위약금이 발생할 수 있습니다.
   ※ 자세한 법적 고지는 추후 업데이트 예정입니다.
   계약 진행 시 금융사별 상세 고지사항을 안내드립니다.
   ```

**주의:**
- 푸터 배경(#1A1A2E)에 어울리는 텍스트 색 사용
- 모바일에서도 펼침/접힘 정상 동작
- 모든 페이지(`/`, `/cars/*`, `/recommend`, `/about` 등)에서 노출되는지 확인

**검증:**
- 푸터에서 아코디언 3개 보임
- 클릭 시 펼침/접힘 정상
- 키보드 Tab → Enter로도 동작

**커밋:** `feat(footer): 약관/모집인/법적 고지 아코디언 추가 (예시 본문)`

---

## 묶음 E — 6단계 플로우 재구성 (가장 큰 변경)

> ⚠ 묶음 A로 옵션 데이터가 이미 바뀐 상태에서 진행. 컴포넌트 분리만 집중.
> ⚠ FlowState 인터페이스 변경됨 → API payload, recommend 점수 로직 모두 영향 받을 수 있음
> ⚠ 각 작업 후 `/recommend` 전체 플로우 정상 진행 확인 필수

### E-12. 3.1 업종 4개 → 3개 + 목적 매핑 재정의 🟢

**파일:**
- `src/constants/recommend-options.ts:3-8` (INDUSTRY_OPTIONS)
- `src/constants/recommend-options.ts:25-42` (목적 매핑 테이블)
- `src/components/recommend/StepIndustry.tsx`

**INDUSTRY_OPTIONS 변경:**
```ts
🏢 법인 (value: 'corporate')
📋 개인사업자 (value: 'business')
👤 개인 (value: 'individual')  // 직장인 + 프리랜서 + 비사업자 통합
```
- 기존 'employee'(직장인) value는 'individual'로 통합

**목적 매핑 변경:**
- 법인: 출퇴근/업무용(통합), 화물/배달, 임원용/의전
- 개인사업자: 출퇴근/업무용, 화물/배달, 가정용
- 개인: 출퇴근/업무용, 화물/배달, 가정용

기존 "영업·외근" 항목은 "출퇴근/업무용"으로 통합.

**주의:**
- 추천 점수 로직(`src/lib/recommend-*.ts`)에서 industry value 참조 시 호환:
  - 'employee' → 'individual'로 매핑 처리 필요 시 알림 후 멈춤
- StepIndustry.tsx의 추가 질문 분기도 영향

**검증:**
- `/recommend` 1단계 → 3개 옵션
- 각 업종 선택 후 2단계 진입 → 위 매핑대로 목적 옵션 노출
- 추천 결과 정상 산출

**커밋:** `feat(recommend): 업종 옵션 3개로 통합 + 목적 매핑 재정의`

---

### E-13. 3.2 업종별 추가 질문 (안내 텍스트 우선) 🟢

**파일:** `src/components/recommend/StepIndustry.tsx` (또는 새 sub-step)

**추가 질문:**

1. **법인 선택 시:** "현재 운용 대수"
   - 옵션: `없음 / 1대 / 2대 이상`
   - state에 저장(예: `fleetSize`)
   - **점수 로직 미연결** — UI만 추가

2. **개인사업자 선택 시:** "사업자 명의 렌트/리스 운용 여부"
   - 옵션: `없음 / 1대 운용 중 / 2대 이상 운용 중`
   - 2대 이상 선택 시 안내 박스:
     > "💡 2대 이상 운용 시 임직원 전용 보험이 필수입니다. 상세 상담을 권장드려요."
   - state 저장(예: `existingLeaseCount`)

3. **개인 선택 시:** "탑승 인원"
   - 옵션: `주로 혼자 타요 / 2~3명 함께 / 4명 이상`
   - state 저장(예: `passengers`)
   - **점수 로직 미연결** — UI만 추가

**주의:**
- FlowState 인터페이스에 3개 필드 추가 (`fleetSize`, `existingLeaseCount`, `passengers` 등)
- 기존 industryDetail 필드가 있다면 활용 (덮어쓰지 말고 확장)
- 추천 API payload에는 포함하되 점수 로직은 무시 (다음 작업에서 연결)

**검증:**
- 1단계 업종 선택 후 추가 질문 노출
- 개인사업자 + 2대 이상 선택 시 안내 박스
- 추천 결과 정상 산출 (변경된 필드가 점수에 영향 안 줌)

**커밋:** `feat(recommend): 업종별 추가 질문 (운용 대수/탑승 인원/임직원보험 안내)`

---

### E-14. 3.5 납입 성향 워딩 변경 + 독립 단계 분리 🟢

**파일:**
- `src/components/recommend/StepPaymentStyle.tsx` (신규)
- `src/components/recommend/StepBudget.tsx` (납입 성향 블록 제거)
- `src/components/recommend/RecommendFlow.tsx` (step 인덱스/네비)
- `src/constants/recommend-options.ts:58-78` (PAYMENT_STYLE_OPTIONS)

**옵션 변경:**
```ts
// 2개로 통합
{ value: 'light', label: '초기 비용 없이 가볍게 시작하고 싶어요', desc: '보증금/선납금 없이, 월 납입금 그대로' },
{ value: 'heavy', label: '보증금·선납금을 넣고 월 비용을 낮추고 싶어요', desc: '초기 비용을 더 부담하더라도 월 납입금을 줄이기' }
```
기존 보수형/표준형/공격형은 light/heavy로 매핑(또는 단순 교체).

**RecommendFlow.tsx 변경:**
- step 배열에 `'paymentStyle'` 추가 (예산 다음, 주행거리 이전)
- FlowState에서 `budget.style` 같은 중첩 구조였다면 최상위로 끌어올림 (`paymentStyle` 필드)

**StepBudget.tsx:**
- 납입 성향 UI 블록 제거, 월 납입금 범위만 남김

**주의:**
- 추천 점수 로직에서 payment style을 참조하면 value 매핑 필요
- 기존 보증금/선납금 비율 입력 UI가 있다면 어느 단계로 갈지 결정 필요 — 일단 새 StepPaymentStyle 안에 유지

**검증:**
- `/recommend` 진행 시 예산 → 납입 성향(별도 단계) → 주행거리 순으로 진행
- 라벨이 새 워딩으로 보임
- 추천 결과 정상

**커밋:** `feat(recommend): 납입 성향 워딩 개선 + 독립 단계로 분리`

---

### E-15. 3.6 주행거리 독립 단계 분리 🟢

**파일:**
- `src/components/recommend/StepMileage.tsx` (신규)
- `src/components/recommend/StepPreference.tsx` (주행거리 블록 제거)
- `src/components/recommend/RecommendFlow.tsx` (step 추가)

**작업:**
1. StepPreference.tsx에서 주행거리 섹션을 그대로 떼어 StepMileage.tsx로 이동
2. A-2에서 추가한 평균 통계 안내 박스가 StepMileage.tsx에 위치하도록
3. RecommendFlow의 step 배열에 `'mileage'` 추가 (납입 성향 다음)
4. FlowState의 `preference.mileage`를 최상위 `mileage`로 끌어올림

**주의:**
- A-2 작업이 먼저 완료된 상태여야 함 (옵션 데이터는 이미 변경됨)
- 추천 점수 로직에서 `preference.mileage` 참조하면 `mileage`로 경로 변경

**검증:**
- 주행거리가 별도 단계로 진행
- 기본값 "적당히 타요(2만)" 강조 유지
- 추천 결과 정상

**커밋:** `feat(recommend): 주행거리 독립 단계로 분리`

---

### E-16. 3.7 연료 방식 독립 단계 분리 🟢

**파일:**
- `src/components/recommend/StepFuel.tsx` (신규)
- `src/components/recommend/StepPreference.tsx` (연료 블록 제거 → 빈 파일이면 삭제)
- `src/components/recommend/RecommendFlow.tsx` (step 추가)

**작업:**
1. StepPreference.tsx에서 연료 섹션을 떼어 StepFuel.tsx로 이동
2. A-3에서 추가한 안내 메시지(전기차+저예산) 로직도 함께 이동
3. RecommendFlow의 step 배열에 `'fuel'` 추가 (주행거리 다음, 마지막 단계)
4. FlowState의 `fuelPreference`를 그대로 사용 (이미 최상위)
5. StepPreference.tsx에 남은 게 없으면 파일 삭제 + import 정리

**최종 step 순서 확인:**
```
1. industry       (업종)
2. purpose        (목적)
3. budget         (예산)
4. paymentStyle   (납입 성향)  ← E-14 신규
5. mileage        (주행거리)   ← E-15 신규
6. fuel           (연료)      ← E-16 신규
```

**검증:**
- 1→2→3→4→5→6단계 전체 정상 진행
- 마지막 6단계 완료 시 추천 결과 페이지 정상 노출
- `npm run build` 통과
- 콘솔 에러 없음

**커밋:** `feat(recommend): 연료 방식 독립 단계로 분리 (6단계 플로우 완성)`

---

## 진행 상태 체크리스트

각 작업 완료 시 체크:

- [ ] A-1. 예산 옵션 축소
- [ ] A-2. 주행거리 옵션 변경
- [ ] A-3. 연료 라벨 + 안내
- [ ] A-4. 계약 종료 삭제
- [ ] B-5. 결과 버튼 강조 반전
- [ ] B-6. 차량 이미지 fallback
- [ ] B-7. 옵션 칩 UI 명확화
- [ ] C-8. 히어로 CTA 반전
- [ ] C-9. 인기 차량 TOP 3 아코디언
- [ ] D-10. Accordion 컴포넌트 신규
- [ ] D-11. 푸터 아코디언 3개
- [ ] E-12. 업종 3개 + 목적 매핑
- [ ] E-13. 업종별 추가 질문
- [ ] E-14. 납입 성향 분리
- [ ] E-15. 주행거리 단계 분리
- [ ] E-16. 연료 단계 분리

---

## 멈춰야 하는 상황

다음 중 하나라도 발생하면 작업 멈추고 사용자 보고:

1. `npm run build` 또는 `npm run typecheck` 실패 — 원인 명시
2. 추천 결과 페이지가 비어있거나 에러 발생
3. Prisma schema 수정이 필요해 보이는 경우
4. API 응답 구조 변경이 필요한 경우
5. 추측이 필요한 의사결정 (이름 짓기/배치 등은 가능, 비즈니스 로직 추측은 금지)
6. 기존 데이터(시드, 견적 산출 등)와 충돌
7. 동일 파일을 두 작업이 동시에 수정해야 하는 경우 — 작업 순서 검토 필요
