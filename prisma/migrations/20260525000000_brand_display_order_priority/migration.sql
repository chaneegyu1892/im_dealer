-- 제조사 정렬 우선순위 적용
-- 현대(1), 기아(2), 제네시스(3), BMW(4), 벤츠(5)는 고정 우선 배치.
-- 그 외 브랜드는 1000번대로 일괄 이동하여 displayOrder ASC, name ASC 조합에서 자연스러운 가나다순.

-- 1. 우선 배치 브랜드
UPDATE "Brand" SET "displayOrder" = 1 WHERE name = '현대';
UPDATE "Brand" SET "displayOrder" = 2 WHERE name = '기아';
UPDATE "Brand" SET "displayOrder" = 3 WHERE name = '제네시스';
UPDATE "Brand" SET "displayOrder" = 4 WHERE name = 'BMW';
UPDATE "Brand" SET "displayOrder" = 5 WHERE name = '벤츠';

-- 2. 그 외 브랜드: 1000으로 통일 (가나다 정렬은 secondary key인 name ASC 가 담당)
UPDATE "Brand"
SET "displayOrder" = 1000
WHERE name NOT IN ('현대', '기아', '제네시스', 'BMW', '벤츠');
