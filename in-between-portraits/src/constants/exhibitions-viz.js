/** Same inset as Sankey `extent` / inner plot band. */
export const EXHIBITIONS_VIZ_MARGIN = {
  top: 12,
  right: 220,
  bottom: 12,
  left: 236,
};

/** Sankey links and timeline baseline stroke (px). */
export const EXHIBITIONS_LINK_STROKE_PX = 1.1;

/**
 * Sankey node column thickness (`nodeWidth`) and timeline markers (square w × h).
 * Change this single value to resize nodes in both views.
 */
export const EXHIBITIONS_NODE_SIZE_PX = 8;

/**
 * Shared scale factor for exhibition rectangle heights across timeline and Sankey.
 * Heights remain proportional to artist count while matching between both views.
 */
export const EXHIBITIONS_MARK_HEIGHT_PER_ARTIST_PX = 6;

export function exhibitionMarkHeightPx(artistCount) {
  const count = Number.isFinite(artistCount) ? artistCount : 0;
  return Math.max(EXHIBITIONS_NODE_SIZE_PX, count * EXHIBITIONS_MARK_HEIGHT_PER_ARTIST_PX);
}

/** Corner radius for Sankey rects and timeline markers (`rx` / `ry`). */
export const EXHIBITIONS_NODE_RX_PX = 1;
