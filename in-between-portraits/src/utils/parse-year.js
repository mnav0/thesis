/**
 * Extracts the first four-digit year from a date string.
 * Handles prefixes like "c." / "ca." and ranges like "1951 - 1952".
 */
export function parseYear(dateStr) {
  if (!dateStr) return NaN;
  const s = dateStr.replace(/c\.?|ca\.?/i, "").trim();
  const match = s.match(/(\d{4})/);
  return match ? +match[1] : NaN;
}
