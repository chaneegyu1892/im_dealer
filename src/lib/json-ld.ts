/** HTML script 컨텍스트에 넣을 JSON-LD 직렬화. */
export function serializeJsonLd(value: unknown): string {
  const json = JSON.stringify(value) ?? "null";
  return json
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
