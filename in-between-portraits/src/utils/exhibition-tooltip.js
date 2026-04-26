/**
 * HTML for exhibition node tooltip (Sankey exhibition rects + timeline markers).
 * Matches copy/styling used in ExhibitionsSankey.
 */
export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {object} d
 * @param {string} d.name
 * @param {string} [d.location]
 * @param {string | null} [d.startYear]
 */
export function exhibitionTooltipShowOptions(d) {
  const year = d.startYear ? escapeHtml(d.startYear) : "-";
  const loc = d.location ? escapeHtml(d.location) : "-";
  const artistCount = Array.isArray(d.artistIds)
    ? d.artistIds.length
    : Number.isFinite(Number(d.artistCount))
      ? Number(d.artistCount)
      : null;
  const artistLine =
    artistCount == null
      ? ""
      : `<div>${artistCount} ${artistCount === 1 ? "artist" : "artists"}</div>`;
  return {
    bg: "#fff",
    fg: "#111",
    border: "#111",
    html: `<div style="line-height:1.2"><div><strong>${escapeHtml(d.name)}</strong></div><div style="height:0.8em"></div><div>${loc} (${year})</div>${artistLine}</div>`,
  };
}
