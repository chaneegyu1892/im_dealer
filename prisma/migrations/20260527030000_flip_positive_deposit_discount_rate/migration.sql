-- 보증금 할인율(depositDiscountRate) 부호 정합 마이그레이션
--
-- 배경:
--   calcDepositDiscountRate 헬퍼가 옛 버전에서 (base - dep) / price 식으로 산출해
--   운영자가 정상적으로 dep < base (할인) 로 입력해도 결과가 양수로 저장되었을 가능성.
--   새 컨벤션은 음수=할인 / 양수=가산 이고, 보증금은 음수만 허용.
--
-- 처리:
--   기존 양수값은 옛 산출 버그로 잘못 저장된 값이므로 부호 반전(절댓값 보존, 음수로 전환).
--   음수값은 시드/정상 산출 결과이므로 그대로 유지.
--   0 은 영향 없음.

UPDATE "CapitalRateSheet"
SET "depositDiscountRate" = -"depositDiscountRate"
WHERE "depositDiscountRate" > 0;
