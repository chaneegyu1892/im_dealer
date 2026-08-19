# 비즈톡 알림톡 템플릿 — REVIEW_REQUEST (후기 작성 안내)

**상태:** 검수 미접수. 이 문서는 등록 원문 초안이다. 비즈톡센터에 제출하지 않는다.
**코드 키:** `REVIEW_REQUEST`
**환경변수:** `ALIMTALK_TEMPLATE_REVIEW_REQUEST` (`getTemplateCode`가 `ALIMTALK_TEMPLATE_${key}` 규칙을 쓴다)
**발송 시점:** 어드민이 견적을 `CONVERTED`로 **진입**시킬 때 (`PATCH /api/admin/quotes/[id]`). 이미 `CONVERTED`인 견적의 재저장·철회는 발송하지 않는다.
**참조:** `src/lib/alimtalk/templates.ts`의 `REVIEW_REQUEST_DRAFT`가 단일 소스다. 센터 등록 시 아래 원문을 **한 글자도 바꾸지 말고** 붙여넣는다.

---

## 변수

| 변수 | 용도 | 치환 주체 |
|---|---|---|
| `#{고객명}` | 본문 호칭. 견적 `customerName`, 없으면 `고객` | `buildReviewRequestMessage` |
| `#{링크}` | 버튼 웹링크. `https://`까지 포함된 후기 작성 URL | `buildReviewRequestButtons` (본문에는 넣지 않음) |

버튼 링크의 프로토콜은 **고정 영역**으로 등록한다. `https://#{링크}`처럼 변수에 프로토콜을 남기면 링크 검증(1030)에 걸린다.

---

## 등록 원문 (`REVIEW_REQUEST_DRAFT`)

```
[아임딜러] 후기 작성 안내

#{고객명}님, 계약이 완료되었습니다.

이용 경험에 대한 후기를 남겨주시면 다른 고객님께 큰 도움이 됩니다.

아래 버튼에서 후기를 작성하실 수 있습니다.

※ 본 메시지는 계약을 완료하신 고객님께 발송되는 안내입니다.
```

## 버튼

| name | type | url_mobile / url_pc |
|---|---|---|
| 후기 작성하기 | `WL` | 발급된 review-token URL (`/reviews/write/{token}`) |

## 큐 적재

- `templateKey`: `REVIEW_REQUEST`
- `phone`: `SavedQuote.phone`
- `refType`: `review`
- `refId`: 견적 id
- `ALIMTALK_ENABLED !== "true"`이면 적재하지 않고 `{ ok: false, reason: "disabled" }`. 토큰은 이미 발급·재사용된 뒤다. PATCH는 200을 유지한다.
