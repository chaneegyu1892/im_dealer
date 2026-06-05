-- 전기차 보조금(안내용) 컬럼 추가 (nullable, additive — 기존 데이터 무손상).
-- 사용자 화면 안내 표기 전용이며 견적 계산에는 반영하지 않는다. null = 보조금 없음.
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "evSubsidy" INTEGER;
