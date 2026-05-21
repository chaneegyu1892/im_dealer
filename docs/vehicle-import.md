# 외부 JSON 임포트 작업 로그

> 브랜치: `feat/vehicle-import`
> 시작일: 2026-05-20

## 목적

외부 차량 데이터 소스 의 `raw_data_ko_car.json` (112 모델) + `raw_data_imported_car.json` (314 모델)을 운영 DB 에 임포트.

## 임포트 전략 (B+ 하이브리드)

- 기존 27 차량 + 9,128 회수율 + 27 추천설정 + 1 재고: **유지** (운영 데이터 보호)
- 신규 외부 차량: `externalId` 표기 + `externalSource='external'` + `isVisible=false` 로 임포트
- 어드민에서 검증 후 사용자가 직접 `isVisible=true` 토글하여 점진 노출
- JSON 구조는 jsonb 컬럼 (`detailedSpecs`, `metadata`) 에 통째로 보존 (정보 손실 0)

## 백업

| 파일 | 행수 | 비고 |
|---|---|---|
| `backup/vehicle-import-20260520_174022.sql` | 22,157 INSERT | 9개 테이블 data-only |

복원: `psql $DATABASE_URL < backup/vehicle-import-YYYYMMDD_HHMMSS.sql` (대상 테이블 비운 후)

## Phase 진행 상황

- [x] Phase 0: 브랜치 + 백업 (2026-05-20)
- [x] Phase 1: 스키마 확장 마이그레이션 (externalId/jsonb 컬럼)
- [x] Phase 2: 코드 변환 매핑 상수 (vehicle-import-mappings.ts)
- [x] Phase 3: 임포트 스크립트 (scripts/import-vehicles.ts, dry-run/model/brand/all 플래그)
- [x] Phase 4: 그랜저 11874 시험 임포트 (2026-05-20)
- [x] Phase 5: 전체 임포트 (2026-05-21, 425/426 성공)
- [x] A 강화판: JSON spec → 기존 UI 호환 jsonb 변환 (CarDetailClient 상세 제원 정상 표시)

## 최종 임포트 결과

| 항목 | 수치 |
|---|---|
| 신규 Vehicle | 425 (`externalSource='external'`, isVisible=false) |
| VehicleLineup | 1,556 |
| Trim | 5,248 |
| TrimOption | 19,557 |
| VehicleColor | 4,922 |
| 실패 | 1 (modelId 11858 Bentley Valour, basePrice 28억 → INT4 초과, 무시) |

기존 데이터 무영향 확인:
- Vehicle (externalSource IS NULL): 27 그대로
- CapitalRateSheet: 9,130 그대로

## 운영 작업 (남은 사람 작업)

1. 어드민에서 신규 425대 검토 후 노출 결정 (`isVisible` 토글)
2. 캐피탈사 회수율 입력 — 더 뉴 그랜저는 자동 채우기 버튼 (`AUTO_FILL_ENABLED_SLUGS`) 사용 가능
3. 28억 초과 슈퍼카 처리 필요 시 `Vehicle.basePrice` Int → BigInt 마이그레이션

## 롤백 SQL

신규 임포트만 정리:
```sql
DELETE FROM "Vehicle" WHERE "externalSource" = 'external';
-- CASCADE 로 VehicleLineup / Trim / TrimOption / VehicleColor 자동 삭제
-- 기존 27대는 externalSource IS NULL 이므로 영향 없음
```

전체 복원:
```sql
TRUNCATE "Vehicle" CASCADE;
\i backup/vehicle-import-YYYYMMDD_HHMMSS.sql
```
