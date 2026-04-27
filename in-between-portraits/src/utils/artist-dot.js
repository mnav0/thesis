/**
 * Per-artist dot silhouettes. Each SVG file in `src/assets/artist-dots/<id>.svg`
 * is loaded eagerly at build time and parsed into `{ viewBox, d }` so callers
 * can render inline SVG without a runtime fetch.
 */

const RAW_SVG_BY_PATH = import.meta.glob("../assets/artist-dots/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
});

/** id (string) -> { viewBox, d } */
const ARTIST_DOTS = {};
for (const [path, raw] of Object.entries(RAW_SVG_BY_PATH)) {
  const idMatch = path.match(/(\d+)\.svg$/);
  const viewBoxMatch = raw.match(/viewBox="([^"]+)"/);
  const dMatch = raw.match(/<path[^>]*\sd="([^"]+)"/);
  if (!idMatch || !viewBoxMatch || !dMatch) continue;
  ARTIST_DOTS[idMatch[1]] = { viewBox: viewBoxMatch[1], d: dMatch[1] };
}

export const artistDotIds = Object.keys(ARTIST_DOTS)
  .map(Number)
  .sort((a, b) => a - b);

/** Returns `{ viewBox, d }` for the given id, or null if not found. */
export function getArtistDotData(artistId) {
  if (artistId == null) return null;
  return ARTIST_DOTS[String(artistId)] ?? null;
}

/**
 * Returns ready-to-inject `<svg>...</svg>` markup. Used in plain DOM contexts
 * (scroll animations) where mounting a Vue component is overkill.
 */
export function artistDotInlineSvg(
  artistId,
  { fill = "#000", stroke = "none", strokeWidth = 0 } = {},
) {
  const dot = getArtistDotData(artistId);
  if (!dot) return "";
  const strokeAttrs =
    stroke && stroke !== "none"
      ? ` stroke="${stroke}" stroke-width="${strokeWidth}" vector-effect="non-scaling-stroke"`
      : "";
  return (
    `<svg viewBox="${dot.viewBox}" preserveAspectRatio="xMidYMid meet" ` +
    `xmlns="http://www.w3.org/2000/svg" aria-hidden="true" ` +
    `style="display:block;width:100%;height:100%;pointer-events:none">` +
    `<path d="${dot.d}" fill="${fill}"${strokeAttrs} />` +
    `</svg>`
  );
}
