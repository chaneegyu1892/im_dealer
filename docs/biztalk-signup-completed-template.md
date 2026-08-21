# 비즈톡 알림톡 템플릿 — SIGNUP_COMPLETED (회원가입 완료 안내)

**상태:** 검수 미접수. 이 문서는 등록 원문 초안이다.
**코드 키:** `SIGNUP_COMPLETED`
**환경변수:** `ALIMTALK_TEMPLATE_SIGNUP_COMPLETED` (`getTemplateCode`가 `ALIMTALK_TEMPLATE_${key}` 규칙을 쓴다)
**발송 시점:** 간편가입 폼(`/welcome`)에서 `POST /api/auth/complete-profile`이 **최초로** `profileCompleted`를 켤 때. 이미 완료된 회원의 정보 재저장은 발송하지 않는다.
**참조:** `src/lib/alimtalk/templates.ts`의 `SIGNUP_COMPLETED_DRAFT`가 단일 소스다. 센터 등록 시 아래 원문을 **한 글자도 바꾸지 말고** 붙여넣는다.

---

## 변수

| 변수 | 용도 | 치환 주체 |
|---|---|---|
| `#{고객명}` | 본문 호칭. 가입 폼에 입력한 이름 | `buildSignupCompletedMessage` |
| `#{가입일}` | 가입 완료 시각(`profileCompletedAt`)을 KST 기준 `2026년 8월 21일` 형식으로 | `buildSignupCompletedMessage` |
| `#{추천코드}` | 회원 본인의 추천 코드(예: `K4821`). `ensureUserReferralCode` 반환값 | `buildSignupCompletedMessage` |

버튼 링크는 변수 없는 **고정 링크**로 등록한다(`SIGNUP_COMPLETED_MYPAGE_URL`). 등록 링크와 발송 링크가 다르면 링크 검증(1030)에 걸린다.

**쿠폰 안내를 넣지 않는다.** 가입 시 SIGNUP 쿠폰이 함께 발급되지만, 쿠폰·혜택 문구는 광고성으로 분류되어 템플릿 전체가 반려된다.

---

## 등록 원문 (`SIGNUP_COMPLETED_DRAFT`)

```
[아임딜러] 회원가입 완료 안내

#{고객명}님, 아임딜러 회원가입이 완료되었습니다.

■ 가입일: #{가입일}
■ 회원 추천코드: #{추천코드}

아래 버튼에서 내 견적 내역과 회원 정보를 확인하실 수 있습니다.

※ 본 메시지는 회원가입을 완료하신 고객님께 발송되는 안내입니다.
```

## 버튼

| name | type | url_mobile / url_pc |
|---|---|---|
| 마이페이지 바로가기 | `WL` | `https://www.imdealer.co.kr/mypage` (고정) |

## 큐 적재

- `templateKey`: `SIGNUP_COMPLETED`
- `phone`: `User.phone` (가입 폼 필수 입력, `toDomesticKR` 정규화 후)
- `refType`: `signup` / `refId`: 회원 id
- `ALIMTALK_ENABLED !== "true"`이면 적재하지 않고 `{ ok: false, reason: "disabled" }`.
- 적재 실패는 라우트에서 로그만 남기고 삼킨다. **알림톡 때문에 가입이 실패하면 안 된다.**
