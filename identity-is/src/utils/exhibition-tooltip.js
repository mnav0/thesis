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
 * @param {number} artistCount
 */
export function exhibitionTooltipShowOptions(d, artistCount) {
  const year = d.startYear
    ? `<div style="margin-top:2px">${escapeHtml(d.startYear)}</div>`
    : "";
  const loc = d.location
    ? `<div style="margin-top:4px">${escapeHtml(d.location)}</div>`
    : "";
  const n = artistCount;
  return {
    bg: "#fff",
    fg: "#111",
    border: "#111",
    html: `<div><strong>${escapeHtml(d.name)}</strong></div>${year}${loc}
                 <div style="margin-top:4px">${n} artist${n !== 1 ? "s" : ""}</div>`,
  };
}
