# 카카오싱크 전환 — 설정 가이드 (팀원용)

**목적:** 카카오싱크(간편가입)로 **회원가입 + 카카오 채널추가 + 마케팅 수신동의**를 한 동의창에서 받는다.
이는 "견적서 받기 → 채널추가 → 카톡으로 견적서 자동발송" 자동화의 기반이다.
(전체 그림: [kakao-sync-quote-automation-plan.md](kakao-sync-quote-automation-plan.md))

> ⚠️ **카카오 콘솔 승인, Vercel 환경변수, DB·Storage 마이그레이션 적용이 필요**하며 코드 머지만으로 운영 발송이 켜지지는 않는다.

---

## 0. 공통 전제 (전화번호 작업과 겹침)

- **비즈니스 앱 전환** — 카카오싱크·전화번호 모두의 공통 전제. [kakao-phone-capture-setup.md](kakao-phone-capture-setup.md)에서 이미 진행 중이면 재사용.
- 설정 대상 앱 = **Supabase에 연결된 카카오 앱** (Supabase → Authentication → Providers → Kakao의 REST API 키와 동일한 앱).

---

## 1. 팀원 To-Do 체크리스트

- [ ] **A. 비즈니스 채널 개설 + 앱에 연결**
- [ ] **B. 카카오싱크(간편가입) 신청·활성화**
- [ ] **C. 동의항목 설정** (프로필·이메일·이름·전화번호·카카오톡 메시지·마케팅 약관)
- [ ] **D. Redirect URI / Supabase 확인**
- [ ] **E. Web 도메인 등록 + DB·Storage 마이그레이션 적용**
- [ ] **F. 테스트 계정으로 로그인 → 견적 저장 → 나에게 보내기 실측**

---

### A. 비즈니스 채널 개설 + 연결

1. [카카오 비즈니스](https://business.kakao.com) → 카카오톡 채널 개설(사업자 인증)
2. 카카오 개발자 콘솔 → 해당 앱 → **제품 설정 → 카카오 로그인 → 카카오싱크** (또는 채널 연결 메뉴)에서 채널 연결
3. **채널의 UUID / encoded_id(`_xxxxx`)를 메모** — 나중에 `KAKAO_CHANNEL_ID` 환경변수로 사용

### B. 카카오싱크(간편가입) 신청·활성화

1. 제품 설정 → 카카오 로그인 → **카카오싱크** → 간편가입 활성화 신청
2. 서비스 약관/개인정보 처리방침 URL 등록 (이미 있음: /terms, /privacy)

### C. 동의항목 설정

- 제품 설정 → 카카오 로그인 → **동의항목**
- 필요 항목:
  - 프로필(닉네임/이미지) — 기존
  - 이메일(account_email), 이름(name)
  - **전화번호(phone_number)** — 검수 필요(전화번호 가이드 참고)
  - **카카오톡 메시지 전송(talk_message)** — 견적서 "나에게 보내기"에 필요
  - 서비스 약관의 마케팅 tag — `KAKAO_MARKETING_TERMS_TAG`와 동일하게 설정
- 채널 관계 확인은 선택 기능이다. 현재 로그인 scope에는 `plusfriends`를 요청하지 않으며, 마케팅 동의 여부에도 채널 추가 상태를 사용하지 않는다.

### D. Redirect URI / Supabase

- Redirect URI에 Supabase 콜백 URL 등록(로그인 이미 동작 시 보통 OK)
- Supabase → Kakao provider의 scope에 필요한 항목 반영(콘솔 승인이 먼저)
- 카카오 개발자 콘솔 → 앱 → 제품 링크 관리 → Web 도메인에 `NEXT_PUBLIC_APP_URL`의 운영 도메인을 등록한다. 카카오는 이 도메인의 견적 상세 페이지를 스크랩해 메시지를 만든다.

---

## 2. 운영 실측 절차

1. `NEXT_PUBLIC_KAKAO_SYNC=true`로 빌드·배포한다.
2. 기존 회원은 견적 화면의 "카카오톡으로 견적서 받기"를 눌러 `talk_message` 추가 동의를 진행한다.
3. 동의 후 같은 견적으로 돌아오는지 확인하고 버튼을 다시 누른다.
4. 카카오톡 "나와의 채팅"에 견적 PNG 미리보기와 상세 링크가 도착하는지 확인한다.
5. 상세 링크가 전송한 PNG와 동일한 이미지를 표시하는지 확인한다.
6. `QuoteDelivery.status`가 `SENT`이고 공개 PNG에 고객 이메일이 포함되지 않았는지 확인한다.

---

## 3. 구현된 코드 (배선 완료)

| 파일 | 역할 |
|---|---|
| `src/lib/kakao/scopes.ts` | 요청 스코프 단일 소스 + `isKakaoSyncEnabled()` 플래그 |
| `src/lib/kakao/client-auth.ts` | 로그인·추가동의 OAuth 시작 경로 |
| `src/lib/kakao/account.ts` | `/v2/user/me`(회원번호·실명·이메일·전화번호), `/v1/user/service/terms`(약관 동의 tag) |
| `src/lib/kakao/channel.ts` | 채널추가 확인(`getChannelRelation`) |
| `src/app/auth/callback/route.ts` | 위 3개를 호출해 `User` 에 저장 |
| `src/app/api/quote/deliver/route.ts` | 소유 견적 검증 → PNG 생성·업로드 → 카카오 발송 → 이력 기록 |
| `src/app/(public)/quote/delivery/[id]/page.tsx` | 동일 PNG 상세 페이지 + 카카오 스크랩용 OG 이미지 |

싱크 ON 시 요청 스코프: `profile_nickname,profile_image,account_email,name,phone_number,talk_message`

콜백이 저장하는 값(`User`):

| 컬럼 | 출처 |
|---|---|
| `kakaoId` | `/v2/user/me` 의 `id` — 이후 친구톡 발송 키 |
| `name` | 동의항목 "이름"(실명). 없으면 기존 닉네임 기반 표시명 유지 |
| `email` / `phone` | 동의항목. 전화번호는 카카오 원본(`+82 10-...`) 그대로 저장 |
| `channelRelation` | `ADDED` / `BLOCKED` / `NONE` |
| `marketingConsent` | 마케팅 서비스 약관 tag 동의 시 true. **한 번 켜지면 끄지 않음**(철회는 별도 경로) |
| `consentedAt` | 싱크 동의창 통과 시각 |

> 모든 카카오 API 호출은 실패 시 soft-fail(값 없음)로 처리 — 로그인 흐름을 막지 않는다.

견적 전송은 본인 카카오톡의 "나에게 스크랩 메시지 발송" API를 사용한다. 친구톡 대행사 발송이나 임의 수신자 전송 기능은 포함하지 않는다.

---

## 4. 환경변수

```
NEXT_PUBLIC_KAKAO_SYNC=true      # 카카오 로그인 확장 scope + 견적 전송 CTA/API ON
NEXT_PUBLIC_APP_URL=https://www.imdealer.co.kr  # 제품 링크 관리의 Web 도메인과 일치
KAKAO_CHANNEL_ID=                # 채널 UUID 또는 encoded_id(_xxxxx) — 미설정 시 채널추가 확인만 skip
KAKAO_MARKETING_TERMS_TAG=marketing   # 콘솔에 등록한 마케팅 약관 tag (기본값 marketing)

# 견적서 카카오톡 전송용
KAKAO_REST_API_KEY=              # 앱 REST API 키 — 액세스 토큰 재발급에 필요
KAKAO_CLIENT_SECRET=             # 카카오 콘솔에 표시된 Client Secret
```

> 리프레시 토큰 암호화는 기존 `PII_ENCRYPTION_KEY` 를 재사용한다(`src/lib/pii.ts`).
> 이 키를 분실·교체하면 본인확인 서류와 함께 저장된 리프레시 토큰도 복호화 불가가 되어,
> 회원들이 재로그인해야 전송 기능이 복구된다.

> `NEXT_PUBLIC_KAKAO_REQUEST_PHONE` 은 **제거됨** — 전화번호가 싱크 스코프에 포함되어 `NEXT_PUBLIC_KAKAO_SYNC` 로 통합.
> 문제 발생 시 `NEXT_PUBLIC_KAKAO_SYNC` 를 끄면 프로필-only 로그인으로 즉시 롤백된다(재빌드 필요).

**필수 마이그레이션:**
- `20260720000000_kakao_sync_consent`: 카카오 동의 정보 컬럼
- `20260720010000_quote_delivery`: 리프레시 토큰과 전송 이력
- `20260720020000_quote_image_storage_bucket`: 공개 `quotes` Storage 버킷

이 저장소의 기존 마이그레이션 히스토리는 shadow DB 재생에 제약이 있으므로, 운영 DB에 이미 적용된 항목을 확인한 뒤 누락 SQL만 Supabase SQL Editor에서 실행한다.

## 5. 주의사항

- **검수·신청 소요**: 비즈니스 채널·싱크·전화번호 검수는 각각 영업일 며칠 소요.
- **기존 회원 소급 불가**: 채널추가·마케팅동의는 재로그인/재동의로만 채워짐.
- **배포 안전**: `NEXT_PUBLIC_KAKAO_SYNC=false`면 CTA가 숨겨지고 전송 API는 404를 반환한다.
- **공개 이미지**: 카카오 서버가 읽어야 하므로 사용자 식별자가 없는 UUID 경로의 공개 PNG를 사용한다. 전송 PNG에는 고객 이메일을 렌더링하지 않으며 파일은 5MB 이하여야 한다.
- **카카오싱크 ≠ 전화번호**: 둘 다 비즈니스 앱을 공유하지만 독립. 전화번호는 싱크 없이 먼저 가능.

---

## 6. 요약

```
A. Supabase와 같은 카카오 앱 확인
      ↓
B. 카카오싱크(간편가입) 활성화
      ↓
C. 동의항목(이메일·이름·전화번호·talk_message·마케팅 약관) 설정
      ↓
D. Redirect URI·Web 도메인·환경변수 확인
      ↓
E. DB·Storage 마이그레이션 적용
      ↓
F. 테스트 계정으로 PNG 나에게 보내기와 상세 링크 실측
```
