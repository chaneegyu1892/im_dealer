# 카카오싱크 + 견적서 자동발송 구현 계획서

**작성일:** 2026-07-09
**목표:** 웹에서 "견적서 받기"를 누르면 → 카카오싱크로 회원가입 + 카카오 채널추가 + 마케팅 수신동의를 한 번에 받고 → 채널추가 완료 시 고객의 카카오톡으로 견적서(이미지 + PDF 다운로드 링크)를 자동 발송한다.

---

## 1. 최종 사용자 흐름 (목표)

```
[웹] "카카오톡으로 견적서 받기" 클릭
   │
   ├─ 비로그인 / 채널 미추가
   │     └─ 카카오싱크 동의창 (회원가입 + 채널추가 + 마케팅 수신동의 + 전화번호 제공)
   │           └─ /auth/callback 복귀
   │                 ├─ 채널추가 확인 API 호출
   │                 │     ├─ ADDED  → 견적서 저장 → 친구톡 자동발송 → "카톡으로 보냈어요" 안내
   │                 │     └─ NONE   → "채널 추가하고 받기" 재안내(재동의 유도)
   │                 └─ 견적 draft 복원(기존 로직 재사용)
   │
   └─ 이미 로그인 + 채널 친구
         └─ 즉시 견적서 저장 → 친구톡 자동발송
```

부가: 기존 **PNG 직접 다운로드**는 보조 수단으로 유지.

---

## 2. 현재 코드 기준선 (what exists)

| 영역 | 현재 상태 | 파일 |
|---|---|---|
| 카카오 로그인 | Supabase OAuth, scope = `profile_nickname profile_image`만 | `src/app/(public)/login/LoginContent.tsx` |
| 로그인 콜백 | User upsert (phone/nickname/email 동의 시 수집) | `src/app/auth/callback/route.ts` |
| 견적서 생성 | `POST /api/quote/image` → PNG 즉석 생성·다운로드(저장 안 함), 로그인 필수 | `src/app/api/quote/image/route.ts`, `src/lib/quote-image/render-quote-image.ts` |
| 견적서 트리거 | `handleImageDownload()` → fetch → blob 다운로드 | `src/app/(public)/quote/QuoteClientPageV2.tsx:572` |
| 로그인 유도 모달 | 있음 | `src/components/quote/LoginRequiredModal.tsx` |
| User 모델 | `phone`, `kakaoNickname`, `marketingConsent`, `provider` 컬럼 이미 존재 | `prisma/schema.prisma:567` |
| 파일 저장소 | Supabase Storage (Documents 버킷) 사용 중 | `src/lib/supabase/server.ts` |
| 카카오 메시지 발송 | **없음 (신규 구축 필요)** | — |
| 카카오싱크 | **없음 (신규 구축 필요)** | — |

**핵심:** 인증·데이터·이미지 생성 기반은 상당수 존재. 신규로 붙일 것은 (a) 카카오싱크 동의·채널추가 확인, (b) 견적서 영속화, (c) 대행사 통한 친구톡 발송 파이프라인.

---

## 3. Phase 0 — 사전 준비 (코드 외부, 선행 필수)

> 이 단계가 안 되면 코드가 있어도 발송 불가. 심사에 수일~2주 소요될 수 있어 **가장 먼저 착수**.

1. **카카오 비즈니스 채널 개설** + 사업자 인증 (모빌페이브 사업자 정보 사용 — 최근 커밋 `0579865` 참조)
2. **카카오싱크 신청** (카카오 개발자 콘솔 → 제품 설정 → 카카오싱크 → 간편가입 활성화, 채널 연결)
3. **동의항목 검수 신청**: `전화번호(phone_number)`, `카카오계정(account_email)`은 비즈앱 전환 + 검수 필요
4. **메시지 대행사 계약**: 후보 — Solapi(추천, 개발 친화적) / 알리고 / NHN Cloud Bizmessage
   - 발신프로필키(pfId) 발급, 친구톡 발신 채널 연결
5. **친구톡 vs 알림톡 결정** (아래 4장)
6. **친구톡 이미지/템플릿 사전 등록** (대행사 콘솔)

### 산출물 체크리스트
- [ ] 비즈니스 채널 public ID (예: `_abcдEF`)
- [ ] 카카오싱크 활성 + 채널 연결 완료
- [ ] `phone_number`, `account_email` 동의항목 검수 통과
- [ ] 대행사 API Key / Secret / 발신프로필키(pfId)
- [ ] 친구톡 이미지 발송 방식 확정(대행사 이미지 업로드 API)

---

## 4. 발송 방식 결정 (친구톡 권장)

| | 친구톡 (권장) | 알림톡 |
|---|---|---|
| 대상 | 채널 친구 | 전화번호 있는 누구나(친구 아니어도) |
| 성격 | 광고성 | 정보성 |
| 이미지 첨부 | ✅ (이미지형) → 견적서 PNG 그대로 | 제한적(이미지형 별도) |
| 템플릿 사전승인 | 불필요(발신프로필 승인만) | **필수(건별 심사)** |
| 전제 | 친구추가 + 마케팅 수신동의 | 전화번호 |
| 표기 의무 | (광고)·무료수신거부 | 정보성 문구 |

**결론:** 카카오싱크로 친구추가+마케팅동의를 한 번에 받으므로 **친구톡 이미지형**이 흐름에 가장 잘 맞음. 메시지 = `견적서 PNG 이미지` + `버튼: PDF 원본 다운로드(서명 링크)`.
※ ⚠️ **PDF 파일 자체는 카톡 첨부 불가** → PDF는 반드시 "다운로드 링크"로 제공.

---

## 5. Phase 1 — 카카오싱크 전환

### 1-1. 로그인 요청 확장
`LoginContent.tsx` / `LoginRequiredModal` 의 카카오 로그인 호출에 scope·채널 파라미터 추가.

```ts
await supabase.auth.signInWithOAuth({
  provider: "kakao",
  options: {
    redirectTo,
    // 검수 통과 후:
    scopes: "profile_nickname profile_image account_email phone_number",
    queryParams: {
      // 카카오싱크 채널추가 동의 노출 (카카오 콘솔서 채널 연결 시 자동 노출되나
      // 명시적 채널 지정이 필요하면 아래 파라미터 사용)
      // service_terms, channel_public_id 등은 콘솔 설정에 따름
    },
  },
});
```

> ⚠️ **검증 포인트 1 (최우선):** Supabase 카카오 provider가 카카오싱크 간편가입/채널추가 동의창을 그대로 노출하는지 실측. 노출 안 되면 Supabase를 우회해 카카오 인가요청을 직접 구성(`/oauth/authorize`)하고 콜백에서 Supabase 세션을 별도 수립하는 방식으로 전환.

### 1-2. 채널추가 여부 확인
콜백에서 Supabase 세션의 **provider_token**(카카오 액세스 토큰)으로 카카오 채널 관계 확인 API 호출.

```
GET https://kapi.kakao.com/v1/api/talk/channels?channel_ids=<CHANNEL_UUID>
Authorization: Bearer <provider_token>
→ relation: ADDED | BLOCKED | NONE
```

- `data.session.provider_token` 은 OAuth 로그인 직후 Supabase 세션에 포함됨.
- 신규 파일: `src/lib/kakao/channel.ts` (`getChannelRelation(providerToken)`).

### 1-3. 콜백 로직 확장
`src/app/auth/callback/route.ts`:
- 기존 User upsert 유지
- `marketingConsent` 를 카카오 동의 결과로 갱신
- 채널 relation 결과를 세션/쿼리로 전달하여 프런트가 다음 행동 결정

### 변경 파일
- `src/app/(public)/login/LoginContent.tsx` (scope 확장)
- `src/components/quote/LoginRequiredModal.tsx` (문구: "채널추가하고 카톡으로 받기")
- `src/app/auth/callback/route.ts` (marketingConsent 갱신, 채널 relation 전달)
- **신규** `src/lib/kakao/channel.ts`

---

## 6. Phase 2 — 견적서 영속화 (Storage 저장)

현재는 PNG를 다운로드만 함. 카톡 발송하려면 **공개 접근 가능한 이미지 URL**과 **PDF 다운로드 링크**가 필요.

### 2-1. 저장 API 신설
`POST /api/quote/deliver` (또는 기존 `image` 라우트 확장):
1. 로그인 확인
2. PNG 생성 (`renderQuoteImageBuffer` 재사용)
3. PDF 생성 (기존 PDF 렌더 재사용 — 병합으로 들어온 image 렌더 경로 확인)
4. Supabase Storage 업로드 → `quotes/{quoteId}/image.png`, `quotes/{quoteId}/quote.pdf`
5. `Quote`(또는 신규 `QuoteDelivery`) 레코드 생성 — 파일 경로·수신자·상태 기록
6. 발송 큐에 enqueue (Phase 3)

### 2-2. 서명 URL
- 이미지: 친구톡용은 대행사에 업로드(대행사가 호스팅) 또는 공개 URL 필요
- PDF: **시간제한 서명 URL**(Supabase `createSignedUrl`, 예: 7일) → 친구톡 버튼 링크

### 변경/신규 파일
- **신규** `src/app/api/quote/deliver/route.ts`
- **신규** `src/lib/quote-delivery/store.ts` (Storage 업로드 + 서명 URL)
- 재사용 `src/lib/quote-image/render-quote-image.ts`

---

## 7. Phase 3 — 발송 파이프라인 (대행사 → 친구톡)

### 3-1. 대행사 클라이언트
**신규** `src/lib/kakao/friendtalk.ts` (Solapi 기준 예):
- `uploadFriendtalkImage(pngBuffer) → imageId`
- `sendFriendtalk({ to, pfId, imageId, text, buttons })`
- 인증: `SOLAPI_API_KEY` / `SOLAPI_API_SECRET` (HMAC 서명)

### 3-2. 발송 트리거
채널 relation = ADDED 이고 전화번호 확보 시:
- `deliver` 라우트에서 저장 직후 발송 호출
- 실패 시 재시도 위해 상태 컬럼(`PENDING/SENT/FAILED`)으로 관리, 실패 건은 관리자 화면/크론에서 재발송

### 3-3. 메시지 구성
```
[아임딜러] {차량명} 견적서가 도착했어요 🚗
(견적서 이미지 첨부)
버튼: [PDF로 자세히 보기] → 서명 링크
버튼: [상담 연결] → 채널 채팅
```

### 변경/신규 파일
- **신규** `src/lib/kakao/friendtalk.ts`
- **신규** `src/lib/kakao/messages.ts` (메시지 템플릿 빌더)

---

## 8. Phase 4 — 미추가/실패 Fallback

- **채널 미추가(NONE)**: 발송 불가 → 웹에서 "채널 추가하고 받기" 버튼 재노출(카카오싱크 재요청) + 즉시 PNG 다운로드는 계속 허용
- **전화번호 미동의**: 발송 불가 안내 + 다운로드 대체
- **발송 실패**: `QuoteDelivery.status=FAILED` → 관리자 알림(Slack `notify.ts` 재사용) + 재시도 버튼

---

## 9. Phase 5 — 관리 / 모니터링

- 관리자 화면에 **견적서 발송 로그** 목록(수신자·차량·상태·시각·재발송)
- `src/lib/notify.ts`(Slack)로 발송 실패 알림
- 발송량/성공률 집계 (선택)

### 변경/신규 파일
- **신규** `src/app/api/admin/quote-deliveries/route.ts`
- **신규** `src/components/admin/quote/QuoteDeliveryList.tsx`

---

## 10. 데이터 모델 변경 (Prisma)

```prisma
// 신규: 견적서 발송 이력
model QuoteDelivery {
  id            String   @id @default(cuid())
  userId        String?  // User.id (비회원 발송은 없음)
  supabaseId    String?
  recipientPhone String? // E.164 (+82...) — 발송 대상
  vehicleName   String
  imagePath     String   // Storage 경로 (PNG)
  pdfPath       String   // Storage 경로 (PDF)
  channel       String   @default("friendtalk") // friendtalk | alimtalk
  status        String   @default("PENDING")    // PENDING | SENT | FAILED
  providerMsgId String?  // 대행사 메시지 ID
  failReason    String?
  sentAt        DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([status, createdAt])
  @@index([userId, createdAt])
}
```

`User` 모델은 컬럼 추가 불필요(이미 `phone`, `marketingConsent` 보유). 필요 시 `channelAddedAt DateTime?` 추가 검토.

마이그레이션: `prisma/migrations/<timestamp>_add_quote_delivery/`

---

## 11. 신규/수정 파일 총괄

**신규**
- `src/lib/kakao/channel.ts` — 채널 관계 확인
- `src/lib/kakao/friendtalk.ts` — 대행사 발송 클라이언트
- `src/lib/kakao/messages.ts` — 메시지 빌더
- `src/lib/quote-delivery/store.ts` — Storage 업로드 + 서명 URL
- `src/app/api/quote/deliver/route.ts` — 저장 + 발송 오케스트레이션
- `src/app/api/admin/quote-deliveries/route.ts` — 발송 로그 조회
- `src/components/admin/quote/QuoteDeliveryList.tsx` — 관리자 UI

**수정**
- `src/app/(public)/login/LoginContent.tsx` — scope 확장
- `src/components/quote/LoginRequiredModal.tsx` — 문구/CTA
- `src/app/auth/callback/route.ts` — marketingConsent·채널 relation
- `src/app/(public)/quote/QuoteClientPageV2.tsx` — "카톡으로 받기" CTA + deliver 호출
- `prisma/schema.prisma` — `QuoteDelivery` 추가

---

## 12. 환경변수 (신규)

```
# 카카오
KAKAO_CHANNEL_UUID=          # 채널 관계 확인용 채널 ID
KAKAO_REST_API_KEY=          # (필요 시) 앱 admin/REST 키

# 대행사 (Solapi 예)
SOLAPI_API_KEY=
SOLAPI_API_SECRET=
KAKAO_SENDER_KEY=            # 발신프로필키(pfId)
```

---

## 13. 리스크 & 검증 포인트

| # | 리스크 | 대응 |
|---|---|---|
| 1 | Supabase가 카카오싱크 채널추가 동의창을 안 띄움 | **Phase 1 착수 즉시 실측.** 안 되면 카카오 인가요청 직접 구성 |
| 2 | `phone_number` 동의 검수 지연/반려 | Phase 0에서 조기 신청, 반려 시 사유 보완 |
| 3 | PDF 파일 카톡 직접 첨부 불가 | 이미지 첨부 + PDF 서명 링크로 설계(반영됨) |
| 4 | 친구톡 광고성 규제(수신거부·야간발송 제한 21~08시) | 메시지에 수신거부/광고 표기, 발송 시간 가드 |
| 5 | 전화번호 미동의 사용자 | 다운로드 fallback |
| 6 | 대행사 발송 실패/지연 | status 관리 + 재시도 + Slack 알림 |
| 7 | 서명 URL 만료 후 재발송 시 링크 만료 | 만료 넉넉히(7일) + 재생성 엔드포인트 |

---

## 14. 권장 진행 순서 (마일스톤)

1. **M0 (병렬·즉시)** — Phase 0 외부 신청(비즈채널·싱크·검수·대행사)
2. **M1** — 검증 포인트 1 (Supabase 카카오싱크 채널추가 노출 실측) ← **가장 먼저 코드로 확인**
3. **M2** — Phase 1 카카오싱크 전환 + 채널 relation 확인
4. **M3** — Phase 2 견적서 Storage 영속화
5. **M4** — Phase 3 대행사 친구톡 발송(샌드/테스트 번호)
6. **M5** — Phase 4 fallback + Phase 5 관리/모니터링
7. **M6** — 실사용자 대상 QA·발송 규제 점검 후 배포

> M1(검증)에서 Supabase 연동 가능 여부가 갈리므로, 본격 구현 전 이 실측을 최우선으로 진행할 것을 권장.
