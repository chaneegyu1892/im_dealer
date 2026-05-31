/**
 * 구동방식(2WD/4WD/AWD) 표기 유틸.
 *
 * 외부 원본 데이터의 라인업 이름은 차량마다 일관성이 없다.
 * - HEV 계열: 라인업 이름에 구동방식이 포함됨 (예: "...HEV 4WD 5인승").
 * - 일반 차량: 라인업 이름엔 없고 트림 이름에만 포함됨 (예: "프레스티지 2WD").
 *
 * 화면(어드민 시뮬레이터·고객용 견적)에서 라인업 표기를 통일하기 위해
 * DB를 수정하지 않고 표시 단계에서 구동방식을 파생한다.
 */

const DRIVETRAIN_RE = /\b(2WD|4WD|AWD)\b/i;

/**
 * 문자열에서 구동방식 토큰을 추출한다. 없으면 null.
 * 대문자로 정규화한다.
 */
export function extractDrivetrain(text: string | null | undefined): string | null {
  if (!text) return null;
  const match = text.match(DRIVETRAIN_RE);
  return match ? match[1].toUpperCase() : null;
}

/**
 * 라인업 표시 라벨을 만든다.
 * - 라인업 이름에 이미 구동방식이 있으면 그대로 반환 (HEV — 중복 접미 방지).
 * - 라인업 이름엔 없고 트림 이름에서 추출되면 " · 2WD" 형태로 접미 (일반 차량).
 * - 둘 다 없으면 라인업 이름 그대로 (FWD 전용 차량 등).
 */
export function lineupDisplayLabel(lineupName: string, trimName: string): string {
  if (extractDrivetrain(lineupName)) return lineupName;
  const drivetrain = extractDrivetrain(trimName);
  return drivetrain ? `${lineupName} · ${drivetrain}` : lineupName;
}
