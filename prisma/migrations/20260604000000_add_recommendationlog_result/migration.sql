-- 추천 결과 freeze 스냅샷 컬럼 추가 (nullable, additive — 기존 데이터 무손상).
-- 새로고침/뒤로 시 재계산·LLM 없이 저장본을 그대로 반환하기 위함.
ALTER TABLE "RecommendationLog" ADD COLUMN IF NOT EXISTS "result" JSONB;
