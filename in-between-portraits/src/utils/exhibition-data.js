export function parseArtistIds(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(String(raw).replace(/'/g, '"'));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function exhibitionStartYear(dateStart) {
  if (!dateStart) return null;
  const parts = String(dateStart).split("/");
  const year = Number(parts[parts.length - 1]);
  return Number.isFinite(year) ? String(year) : null;
}
