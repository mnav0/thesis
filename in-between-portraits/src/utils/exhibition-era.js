const CONTEMPORARY_IDS = new Set(["0", "1", "4", "6", "7", "8", "11", "12", "13"]);
const IN_BETWEEN_IDS = new Set(["5", "9", "10"]);
const MODERN_IDS = new Set(["2", "14"]);

export const EXHIBITION_ERA = {
  CONTEMPORARY: "contemporary",
  IN_BETWEEN: "inBetween",
  MODERN: "modern",
};

export function getExhibitionEraById(id) {
  const normalizedId = String(id);
  if (CONTEMPORARY_IDS.has(normalizedId)) return EXHIBITION_ERA.CONTEMPORARY;
  if (IN_BETWEEN_IDS.has(normalizedId)) return EXHIBITION_ERA.IN_BETWEEN;
  if (MODERN_IDS.has(normalizedId)) return EXHIBITION_ERA.MODERN;
  return EXHIBITION_ERA.IN_BETWEEN;
}
