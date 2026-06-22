# Codef 공문서 발급 계약 명세 (스파이크 산출물)

> Task 1 스파이크 결과. developer.codef.io 공개 개발가이드에서 직접 확인(2026-06-22).
> 운영 전환 전 콘솔에서 상품 신청 여부·운영키만 추가 확인 필요(하단).

## 확정된 수집 범위

운전면허는 **기존 진위확인(O/X)만 유지**, 문서 수집 안 함 (운전경력증명서는 Codef 상품에 없음). 발급 대상 3종:

| DocType | 문서 | 기관 | 정식 Endpoint | organization |
|---|---|---|---|---|
| `resident_register` | 주민등록등본 교부 | 정부24 | `/v1/kr/public/mw/resident-registration-copy/issuance` | `0001` |
| `biz_registration_proof` | 사업자등록 증명 | 홈택스 | `/v1/kr/public/nt/proof-issue/corporate-registration` | `0001` |
| `income_proof` | 증명발급 소득금액증명원 | 홈택스 | `/v1/kr/public/nt/proof-issue/proof-income` | `0001` |

- 데모(샌드박스) 호스트: `https://development.codef.io`, 운영 호스트: `https://api.codef.io`
- 모든 상품 organization 고정값 `"0001"`, Timeout 300 / 추가인증 Timeout 270.

## 고객유형별 매핑 (확정)

| 고객유형 | 문서 | 비고 |
|---|---|---|
| individual(개인) | 주민등록등본, 소득금액증명원 | 사업자증명은 개인 발급 불가 |
| self_employed(개인사업자) | 주민등록등본, 사업자등록증명, 소득금액증명원 | ⚠️ 소득금액증명원 "개인사업자 발급 불가(CF-12040)" 경고 — 검증 필요 |
| corporate(법인) | 사업자등록증명 | |

## 공통 — 간편인증 2-way 흐름 (3종 동일)

1. **1차 요청** → `result.code = CF-03002`, `data.continue2Way = true`, `data.method`(인증방식), `data.twoWayInfo = { jobIndex, threadIndex, jti, twoWayTimestamp }`, `data.extraInfo.commSimpleAuth`
2. 사용자 휴대폰 간편인증 앱에서 승인 (타임아웃 **4분 30초**)
3. **2차 요청** → **1차 입력부 전체** + `is2Way: true` + `twoWayInfo: {…1차 응답값}` + `simpleAuth: "1"`
   - 미완료 상태로 `simpleAuth:"1"` 3회 시 `CF-12872` 오류
4. 성공 시 `result.code = CF-00000`, 원본 PDF 포함

### 간편인증 로그인 구분
- `loginType`: `"5"`=회원 간편인증, `"6"`=비회원 간편인증
- `loginTypeLevel`: 1 카카오톡, 3 삼성패스, 4 KB모바일, 5 통신사(PASS), 6 네이버, 7 신한, 8 toss, 9 하나/뱅크샐러드, 10 NH, 11 우리(홈택스만)
- 간편인증 공통 입력: `userName`, `phoneNo`, `loginTypeLevel`, `telecom`(PASS=loginTypeLevel "5"일 때 "0"SKT/"1"KT/"2"LGU+)
- 본인확인값:
  - 등본: 비회원(6)은 `identity`(주민번호) 필수, 회원(5)은 불요
  - 홈택스 2종: 회원(5) `loginIdentity` = **생년월일 8자리 YYYYMMDD**, 비회원(6) `loginIdentity` = 주민번호 13자리

### 인증 방식 결정 — 회원 간편인증(`loginType="5"`) 고정 (2026-06-22)

사용자 결정: **간편인증은 무조건 회원(`loginType="5"`)만 사용.** 비회원(6) 미사용.

- **묶음 인증(다건)은 회원 방식에서만 가능** → 동일 `id`(요청 식별 아이디)로 홈택스 2종(사업자증명+소득)을 **1 로그인 세션 = 간편인증 1회**로 순차 처리. (비회원 6은 다건 불가)
  - 기관이 다르면 세션이 분리되므로, 개인사업자 기준 **정부24(등본) 1회 + 홈택스(사업자증명+소득) 1회 = 총 2회** 인증.
- `connectedId` 불필요: 회원 간편인증은 connectedId 파라미터를 쓰지 않는다(용어집 확인). connectedId는 인증서/ID·PW 저장용 별개 개념(계정등록). → 우리는 간편인증 + `id`만 사용, connectedId 미관리.
- 로그인 세션: 1차 추가인증 완료 후 2차 성공 시 생성, 동일 `id` 후속 요청 없으면 종료.

> ⚠️ 미확정(운영키 테스트로 확인): "회원"이 고객의 **정부24/홈택스 사전 가입**을 요구하는지 여부. 개발가이드만으론 단정 불가 — 실제 호출로 검증.

## 원본 PDF 수신 — 상품별 필드가 다름 (주의)

| 상품 | PDF 요청 파라미터 | PDF 응답 필드 | 비고 |
|---|---|---|---|
| 등본 | `originDataYN: "1"` | `resOriGinalData` (base64 PDF) | |
| 홈택스 사업자증명 | `originDataYN1: "1"` | `resOriGinalData1` (base64) | `originDataYN`/`resOriGinalData`는 **XML** |
| 홈택스 소득금액증명원 | `originDataYN1: "1"` | `resOriGinalData1` (base64) | `originDataYN`/`resOriGinalData`는 **XML** |

- 문서확인번호: 등본 `resDocNo`, 홈택스 2종 `resIssueNo`(발급/승인번호)
- 홈택스 2종: **세무대리인 계정은 PDF 미제공** (본인 발급만)

## 상품별 추가 필수 파라미터

- **등본**: `addrSido`/`addrSiGunGu`(비회원 필수, 공식 지명 — 미준수 시 CF-13002 / 회원은 미입력 시 정부24 회원주소로 발급), 등본 옵션 `pastAddrChangeYN`·`inmateYN`·`relationWithHHYN`·`isIdentityViewYn` 등
- **사업자증명**: `usePurposes`(예 "07":금융기관제출용), `submitTargets`(예 "01":금융기관), 개인 발급 불가
- **소득금액증명원**: `startYear`/`endYear`(과세기간, 1983~작년/재작년), `usePurposes`, `submitTargets`

## 계정/운영 전환 선결 조건 (사용자 직접 — 콘솔 로그인 필요)

- [ ] 위 3종 상품이 Codef 계정에 **사용 신청·승인** 됐는지 확인 (developer.codef.io는 공개 가이드일 뿐, 호출 권한은 계정별)
- [ ] 보유 키가 **운영 키**인지 (현재 코드 baseURL = `https://development.codef.io`)
- [ ] 운영 전환 시 `CODEF_SANDBOX=false` + baseURL `https://api.codef.io`
