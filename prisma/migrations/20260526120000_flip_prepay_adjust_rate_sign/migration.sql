-- 선납금 가산율 부호 컨벤션 변경 (양수=가산, 음수=할인)
--
-- 변경 사항:
--   - 기존: prepayAdjustRate 양수 저장 + calculator 에서 차감하는 방식 (양수=할인 의미)
--   - 신규: prepayAdjustRate 부호 그대로 반영 (양수=가산, 음수=할인)
--
-- 따라서 기존 DB 에 저장된 모든 prepayAdjustRate 값의 부호를 반전한다.
-- 0 값은 영향 없음.

UPDATE "CapitalRateSheet"
SET "prepayAdjustRate" = -"prepayAdjustRate"
WHERE "prepayAdjustRate" <> 0;
