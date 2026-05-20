# Carpan JSON 임포트 작업 로그

> 브랜치: `feat/carpan-import`
> 시작일: 2026-05-20

## 목적

carpan.kr 의 `raw_data_ko_car.json` (112 모델) + `raw_data_imported_car.json` (314 모델)을 운영 DB 에 임포트.

## 임포트 전략 (B+ 하이브리드)

- 기존 27 차량 + 9,128 회수율 + 27 추천설정 + 1 재고: **유지** (운영 데이터 보호)
- 신규 carpan 차량: `externalId` 표기 + `externalSource='carpan'` + `isVisible=false` 로 임포트
- 어드민에서 검증 후 사용자가 직접 `isVisible=true` 토글하여 점진 노출
- JSON 구조는 jsonb 컬럼 (`detailedSpecs`, `metadata`) 에 통째로 보존 (정보 손실 0)

## 백업

| 파일 | 행수 | 비고 |
|---|---|---|
| `backup/carpan-import-20260520_174022.sql` | 22,157 INSERT | 9개 테이블 data-only |

복원: `psql $DATABASE_URL < backup/carpan-import-YYYYMMDD_HHMMSS.sql` (대상 테이블 비운 후)

## Phase 진행 상황

- [x] Phase 0: 브랜치 + 백업 (2026-05-20)
- [ ] Phase 1: 스키마 확장 마이그레이션
- [ ] Phase 2: 코드 변환 매핑 상수
- [ ] Phase 3: 임포트 스크립트 (dry-run)
- [ ] Phase 4: 그랜저 11874 시험 임포트
- [ ] Phase 5: 전체 임포트

## 롤백 SQL

신규 임포트만 정리:
```sql
DELETE FROM "Vehicle" WHERE "externalSource" = 'carpan';
-- CASCADE 로 VehicleLineup / Trim / TrimOption / VehicleColor 자동 삭제
-- 기존 27대는 externalSource IS NULL 이므로 영향 없음
```

전체 복원:
```sql
TRUNCATE "Vehicle" CASCADE;
\i backup/carpan-import-YYYYMMDD_HHMMSS.sql
```
