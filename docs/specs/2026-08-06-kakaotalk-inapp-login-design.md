# 카카오톡 인앱브라우저 로그인 마찰 해소 설계

- 작성일: 2026-08-06
- 대상: `/login` 화면 (`src/app/(public)/login/LoginContent.tsx`)

## 배경

개발 요청사로부터 "카카오톡 채팅방에서 링크를 누르면 새 브라우저로 인식돼 로그인을
다시 해야 한다"는 문의가 접수되었다.

카카오톡 인앱브라우저는 크롬·사파리와 **쿠키 저장소가 분리된 별개의 웹뷰**다. 크롬에
저장된 Supabase 세션 쿠키가 카톡 웹뷰에는 존재하지 않으므로, 서버 입장에서는 처음 온
방문자가 맞다. 웹이라서 생기는 문제가 아니라 웹뷰 샌드박스 구조에서 오는 문제이며,
정식 앱을 출시해도 앱 웹뷰 역시 별도 쿠키 저장소를 쓰기 때문에 그대로 남는다.

세션 갱신 배선 자체는 정상이다. `src/proxy.ts`(Next.js 16에서 `middleware.ts` 가
개명된 파일)가 매 요청 `supabase.auth.getUser()` 로 토큰을 갱신하고 쿠키를 응답에
되쓴다. 일반 브라우저에서 세션이 조기에 끊길 구조적 원인은 없다.

## 목표

카카오톡 인앱브라우저에서 로그인이 필요해진 순간의 마찰을 사실상 0에 가깝게 줄인다.

이 서비스는 로그인이 카카오 OAuth 단독이라 인앱브라우저에서 유리하다. 카톡 인앱
브라우저에서 카카오 로그인을 시작하면 카카오톡에 로그인된 계정으로 간편로그인이
제공되어 계정 입력 단계가 없다. 이미 동의한 사용자는 리다이렉트만 거쳐 돌아온다.

## 비목표

- 견적 페이지(`QuoteClientPageV2.tsx`)의 `startKakaoLogin` 인라인 호출 2곳은 손대지
  않는다. 이미 사용자가 버튼을 누른 시점이라 자동화할 대상이 아니다.
- 네이버·인스타그램·페이스북 등 다른 인앱브라우저는 이번 범위에서 제외한다. 감지
  함수는 패턴 추가 한 줄로 확장 가능한 형태로 두되, 지금 대응하지는 않는다.
- 세션 수명·쿠키 옵션은 변경하지 않는다. 현재 배선에 문제가 없다.
- 서명 토큰 기반 자동 로그인(매직링크)은 이번 범위 밖이다. 견적서 발송 흐름이 확정된
  뒤에 별건으로 검토한다.

## 흐름

```
/login 진입
 └─ getSession()
     ├─ 세션 있음 → router.replace(next)              ← 기존 동작 유지
     └─ 세션 없음
         ├─ 카톡 인앱 && 가드 4개 통과 → startKakaoLogin() 자동 호출
         └─ 그 외 → 기존 로그인 화면
                    └─ 카톡 인앱이면 「다른 브라우저에서 열기」 보조 링크 추가 노출
```

기본 동작은 **인앱브라우저 안에 머무르면서 카카오 로그인을 자동 시작**하는 쪽이다.
외부 브라우저 탈출은 자동으로 실행하지 않고 보조 링크로만 제공한다. 앱 전환은
사용자를 당황시키고, 넘어간 브라우저에 세션이 없으면 어차피 로그인이 필요하므로
기본값으로 삼을 만큼 이득이 크지 않다.

## 무한루프 가드

자동 로그인의 유일한 실질 위험은 리다이렉트 루프다. 아래 네 조건을 **모두** 만족할
때만 발동한다.

| # | 조건 | 이유 |
| --- | --- | --- |
| 1 | 카카오톡 인앱브라우저 | 일반 브라우저는 기존 동작 유지 |
| 2 | Supabase 세션 없음 | 로그인 상태면 자동 시작할 이유가 없음 |
| 3 | URL에 `?error=` 없음 | `auth/callback` 이 실패 시 `/login?error=...` 로 되돌린다. 실패 직후 재시도를 막는다 |
| 4 | `sessionStorage` 플래그 없음 | 같은 탭에서 이미 자동 시도했으면 재시도하지 않는다 |

`sessionStorage` 키는 `imdealer:inapp-auto-login-attempted` 를 쓴다. 탭을 닫으면
사라지므로 다음 방문에는 다시 한 번 자동 시도한다.

사용자가 카카오 동의 화면에서 취소하면 조건 3 또는 4에 걸려 수동 로그인 화면으로
떨어진다. 이때는 「카카오 로그인」 버튼과 「다른 브라우저에서 열기」 링크가 모두 보인다.

자동 시작이 진행되는 동안에는 기존 `isStartingLogin` 상태를 재사용해 "카카오 연결
중…" 문구를 노출한다. 새 로딩 UI를 만들지 않는다.

## 외부 브라우저 탈출 URL

| 플랫폼 | URL |
| --- | --- |
| iOS | `kakaotalk://web/openExternal?url=<encoded>` |
| Android | `intent://<host><path><search>#Intent;scheme=https;S.browser_fallback_url=<encoded>;end` |

Android는 `package=` 를 지정하지 않는다. 처음에는 `package=com.android.chrome` 을 넣었으나,
크롬이 없는 기기에서는 `Intent.parseUri` 가 `ActivityNotFoundException` 을 던지고 카카오톡이
그 즉시 `S.browser_fallback_url`(=지금 보고 있는 페이지의 https URL)로 되돌아가 인앱브라우저
안에서 같은 페이지를 다시 로드할 뿐이라는 문제가 있었다. 사용자 입장에서는 링크를 눌러도
아무 일도 일어나지 않는 것처럼 보인다. `package=` 를 빼면 안드로이드가 브라우저 선택 창을
띄우므로 크롬이 없는 기기에서도 실제로 다른 브라우저로 탈출할 수 있다. `S.browser_fallback_url`
은 그대로 남겨, 아무 앱도 intent 를 처리하지 못하는 극단적인 경우의 안전망으로 둔다.

링크 문구는 「다른 브라우저에서 열기」로 둔다. iOS의 `openExternal` 은 크롬이 아니라
기기 기본 브라우저(대개 사파리)를 열기 때문에 「크롬에서 열기」는 부정확하다. 플랫폼별로
문구를 분기하면 UA 판별 결과가 UI까지 새어 나오므로 중립적인 한 문구로 통일한다.

입력 URL은 `http:` 와 `https:` 만 허용한다. 그 외에는 `null` 을 반환하고, 호출부는
`null` 일 때 버튼 자체를 렌더링하지 않는다. 차단하려는 대상은 `javascript:`·`data:`
처럼 스킴 문자열에 섞여 들어가면 위험한 값이므로, `http:` 를 함께 허용해도 보안
성질은 유지된다. 로컬 개발과 jsdom 기본 오리진이 `http://localhost` 라서 `https`
전용으로 좁히면 개발·테스트에서만 동작이 갈리는 부작용이 생긴다.

Android intent URL 의 `scheme` 값은 하드코딩하지 않고 입력 URL 의 실제 프로토콜에서
가져온다. 원본 URL 의 해시(`#...`)는 intent URI 의 `#Intent` 구분자와 충돌하므로
경로에서 제외하되, `S.browser_fallback_url` 에는 해시를 포함한 전체 URL 을 넣는다.

데스크톱 카카오톡의 UA(예: `... KAKAOTALK`, 버전 토큰 없음)도 `KAKAOTALK` 토큰을 포함해
`isKakaoTalkInApp` 이 참이 되므로, PC 카카오톡 내장 브라우저에서도 자동 로그인은 그대로
실행된다. 다만 `buildEscapeUrl` 은 데스크톱에 대응하는 탈출 스킴이 없어 `null` 을 반환하고,
그 결과 「다른 브라우저에서 열기」 링크는 노출되지 않는다. 이는 의도된 동작이다. 무한루프
가드 3번(서버가 콜백 실패 시 `/login?error=...` 로 되돌리는 것)이 인앱 여부·플랫폼과 무관하게
항상 적용되므로, 데스크톱 카카오톡에서 탈출 링크가 없어도 루프에 빠지지 않는다.

## 변경 대상

| 파일 | 변경 |
| --- | --- |
| `src/lib/browser/in-app.ts` | 신규. UA 판별과 탈출 URL 생성. 순수 함수만 |
| `src/lib/browser/in-app.test.ts` | 신규. UA 픽스처 기반 유닛테스트 |
| `src/hooks/useKakaoTalkInApp.ts` | 신규. `navigator.userAgent` 주입, SSR 안전 |
| `src/app/(public)/login/LoginContent.tsx` | 자동 로그인 배선 · 탈출 링크 노출 |
| `src/app/(public)/login/LoginContent.test.tsx` | 가드 4개 검증 케이스 추가 |

### `src/lib/browser/in-app.ts`

```ts
export function isKakaoTalkInApp(userAgent: string): boolean
export function buildEscapeUrl(targetUrl: string, userAgent: string): string | null
```

UA 문자열을 인자로 받는 순수 함수로 둔다. 전역 `navigator` 를 직접 읽지 않으므로
실기기 없이 테스트할 수 있다. 카카오톡 UA는 iOS·Android 모두 `KAKAOTALK` 토큰을
포함하며, 대소문자 무시 매칭한다.

플랫폼 판별은 이 파일 안에 두고 밖으로 노출하지 않는다. 호출부가 알아야 할 것은
"탈출 URL이 있는가 없는가"뿐이다.

### `src/hooks/useKakaoTalkInApp.ts`

```ts
export function useKakaoTalkInApp(): { isInApp: boolean; escapeUrl: string | null }
```

초기값을 `{ isInApp: false, escapeUrl: null }` 로 두고 `useEffect` 안에서
`navigator.userAgent` 를 읽는다. 서버 렌더 결과와 첫 클라이언트 렌더가 일치해야
hydration 불일치가 나지 않는다.

### `LoginContent.tsx`

기존 세션 확인 `useEffect` 를 확장한다. 세션이 있으면 지금처럼 `router.replace(next)`
하고, 없을 때만 가드를 평가해 자동 로그인을 시작한다. 자동 시작 경로도 기존
`handleKakaoLogin` 과 같은 오류 처리를 타야 하므로 `startKakaoLogin` 호출을 공통
함수로 묶는다.

「다른 브라우저에서 열기」 링크는 카카오 로그인 버튼 아래, 약관 안내 위에 배치한다.
`escapeUrl` 이 `null` 이면 렌더링하지 않는다.

## 테스트

**유닛** (`in-app.test.ts`)

- 카톡 iOS / 카톡 Android / 사파리 / 크롬 / 빈 문자열 UA 픽스처로 `isKakaoTalkInApp` 판별
- iOS·Android 각각의 탈출 URL 형식 검증. Android는 `S.browser_fallback_url` 포함 확인
- `javascript:`, `data:` 등 허용되지 않는 스킴 입력에 `null` 반환 확인 (`http:`, `https:` 는 허용)
- 카톡이 아닌 UA에 `null` 반환 확인

**컴포넌트** (`LoginContent.test.tsx`)

- 가드 4개를 각각 하나씩 깨뜨렸을 때 `startKakaoLogin` 이 호출되지 않는 것을 검증
- 4개가 모두 통과할 때만 호출되는 것을 검증
- 카톡 인앱이 아닐 때 「다른 브라우저에서 열기」 링크가 렌더링되지 않는 것을 검증

**실기기 검증 (필수, 자동화 불가)**

실제 카카오톡 인앱브라우저의 OAuth 동작은 UA 스푸핑으로 확인할 수 없다. 머지 전에
iOS·Android 실기기에서 아래를 직접 확인해야 한다.

1. 카톡 채팅방에 `/login` 링크를 보내고 눌렀을 때 자동으로 카카오 동의 화면이 뜨는가
2. 동의 후 원래 목적지(`next`)로 정상 복귀하는가
3. 동의 화면에서 취소했을 때 루프 없이 수동 로그인 화면에 머무는가
4. 「다른 브라우저에서 열기」가 실제로 외부 브라우저를 여는가

## 위험 요소

- **자동 시작이 카카오 정책에 막힐 가능성**: 현재까지 카톡 인앱브라우저에서 카카오
  OAuth 리다이렉트가 차단된다는 근거는 없으나, 실기기 검증 1번에서 확인한다.
- **`sessionStorage` 미지원 환경**: 접근이 실패하면 예외를 삼키고 자동 시작을
  건너뛴다. 기존 수동 로그인으로 떨어지므로 기능 손실은 없다.
