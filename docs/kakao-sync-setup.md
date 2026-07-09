# 카카오싱크 전환 — 설정 가이드 (팀원용)

**목적:** 카카오싱크(간편가입)로 **회원가입 + 카카오 채널추가 + 마케팅 수신동의**를 한 동의창에서 받는다.
이는 "견적서 받기 → 채널추가 → 카톡으로 견적서 자동발송" 자동화의 기반이다.
(전체 그림: [kakao-sync-quote-automation-plan.md](kakao-sync-quote-automation-plan.md))

> ⚠️ **콘솔 설정 + 접근방식 검증이 필요**하며, 코드만으로는 완성되지 않는다.
> 채널추가 확인 코드(`src/lib/kakao/channel.ts`)는 준비돼 있고, **콘솔 세팅 → 호환 검증 → 배선(wiring)** 순으로 진행한다.

---

## 0. 공통 전제 (전화번호 작업과 겹침)

- **비즈니스 앱 전환** — 카카오싱크·전화번호 모두의 공통 전제. [kakao-phone-capture-setup.md](kakao-phone-capture-setup.md)에서 이미 진행 중이면 재사용.
- 설정 대상 앱 = **Supabase에 연결된 카카오 앱** (Supabase → Authentication → Providers → Kakao의 REST API 키와 동일한 앱).

---

## 1. 팀원 To-Do 체크리스트

- [ ] **A. 비즈니스 채널 개설 + 앱에 연결**
- [ ] **B. 카카오싱크(간편가입) 신청·활성화**
- [ ] **C. 동의항목 설정** (프로필·전화번호·마케팅 수신동의·채널추가)
- [ ] **D. Redirect URI / Supabase 확인**
- [ ] **E. ⚠️ Supabase 호환 검증** (채널추가 동의창이 뜨는지) ← 코드 방향 결정 분기점

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
  - **전화번호(phone_number)** — 검수 필요(전화번호 가이드 참고)
  - **카카오톡 채널 추가 상태 및 광고성 정보 수신 동의** — 카카오싱크에서 채널추가 + 마케팅 동의를 받는 항목
- 채널추가는 "동의창에서 체크로 친구추가"가 되도록 싱크 설정에서 활성화

### D. Redirect URI / Supabase

- Redirect URI에 Supabase 콜백 URL 등록(로그인 이미 동작 시 보통 OK)
- Supabase → Kakao provider의 scope에 필요한 항목 반영(콘솔 승인이 먼저)

---

## 2. ⚠️ E. Supabase 호환 검증 (가장 중요)

**핵심 질문:** Supabase 표준 OAuth 플로우가 카카오싱크의 **"채널 추가" 동의창**을 그대로 띄우는가?
→ 이 결과가 전체 코드 방향을 가른다.

### 검증 절차 (A~D 완료 후)
1. 시크릿 창/테스트 계정으로 **카카오 로그인 시도**
2. 카카오 동의창에 **"카카오톡 채널 추가"** 항목이 표시되는지 **육안 확인**
3. 로그인 후, `provider_token`으로 채널 관계를 확인:
   - 임시로 콜백(`auth/callback`)에서 아래를 호출해 로그로 확인
   ```ts
   import { getChannelRelation } from "@/lib/kakao/channel";
   const rel = await getChannelRelation(providerToken, process.env.KAKAO_CHANNEL_ID!);
   console.log("[kakao channel relation]", rel); // ADDED | BLOCKED | NONE
   ```
4. **판정**
   | 관찰 | 결론 |
   |---|---|
   | 동의창에 채널추가 O + 로그인 후 relation `ADDED` | ✅ **Supabase 유지 가능** — 이후 코드 배선만 |
   | 동의창에 채널추가 항목이 아예 안 뜸 | ❌ Supabase가 싱크 파라미터를 안 넘김 → **카카오 인가요청 직접 구성** 필요(별도 설계) |

> 검증 전까지는 배선(콜백에서 relation 저장·활용)을 확정하지 않는다. 스캐폴딩만 둔 이유.

---

## 3. 준비된 코드 (스캐폴딩)

| 파일 | 상태 |
|---|---|
| `src/lib/kakao/channel.ts` | ✅ 채널추가 확인 유틸(`getChannelRelation`, `parseChannelRelation`) — 검증/배선에 사용 |
| `src/lib/kakao/channel.test.ts` | ✅ 파싱 로직 단위테스트(7 케이스) |
| `src/app/auth/callback/route.ts` | 전화번호 저장까지 구현됨. **채널 relation·마케팅동의 저장은 검증 후 배선** |

**검증 통과 후 배선 예정 작업(별도 PR):**
- 콜백에서 `getChannelRelation`으로 채널추가 확인 → 결과에 따라 분기(가입 완료 / 채널추가 재안내)
- 마케팅 수신동의 저장(`User.marketingConsent`, 컬럼 이미 존재)
- 견적서 자동발송 연결(플랜 Phase 2~3)

---

## 4. 환경변수 (예정)

```
KAKAO_CHANNEL_ID=            # 채널 UUID 또는 encoded_id(_xxxxx) — 채널추가 확인용
# 활성화 플래그(전화번호와 동일 패턴, 검수/검증 후 ON)
NEXT_PUBLIC_KAKAO_REQUEST_PHONE=true   # 전화번호 수집(별도 문서)
```

## 5. 주의사항

- **검수·신청 소요**: 비즈니스 채널·싱크·전화번호 검수는 각각 영업일 며칠 소요.
- **기존 회원 소급 불가**: 채널추가·마케팅동의는 재로그인/재동의로만 채워짐.
- **배포 안전**: 코드 스캐폴딩은 아직 로그인 흐름에 연결돼 있지 않아(유틸만) 배포해도 동작 변화 없음.
- **카카오싱크 ≠ 전화번호**: 둘 다 비즈니스 앱을 공유하지만 독립. 전화번호는 싱크 없이 먼저 가능.

---

## 6. 요약

```
A. 비즈니스 채널 개설 + 앱 연결 (채널 ID 확보)
      ↓
B. 카카오싱크(간편가입) 활성화
      ↓
C. 동의항목(전화번호·채널추가·마케팅) 설정 + 검수
      ↓
D. Redirect URI / Supabase 확인
      ↓
E. ⚠️ Supabase가 채널추가 동의창을 띄우는지 검증  ← 코드 방향 분기
      ↓
(검증 통과) 콜백 배선 + 견적서 자동발송 연결 (별도 PR)
```
