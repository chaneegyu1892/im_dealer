-- Brand.isFeatured 컬럼 추가
-- 인기 브랜드 그룹 플래그. 정렬·노출에서 일반 브랜드보다 우선 표시.

ALTER TABLE "Brand" ADD COLUMN "isFeatured" BOOLEAN NOT NULL DEFAULT false;

-- 기존 우선순위 5개를 isFeatured = true 로 설정
UPDATE "Brand" SET "isFeatured" = true
WHERE name IN ('현대', '기아', '제네시스', 'BMW', '벤츠');
