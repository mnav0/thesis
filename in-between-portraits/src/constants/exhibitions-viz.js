/** Shared layout so exhibition timeline and Sankey SVG coordinates align. */
export const EXHIBITIONS_VIZ_MAX_WIDTH_PX = 1100;

/** Same inset as Sankey `extent` / inner plot band. */
export const EXHIBITIONS_VIZ_MARGIN = {
  top: 12,
  right: 220,
  bottom: 12,
  left: 200,
};

/** Sankey links and timeline baseline stroke (px). */
export const EXHIBITIONS_LINK_STROKE_PX = 1.1;

/**
 * Sankey node column thickness (`nodeWidth`) and timeline markers (square w × h).
 * Change this single value to resize nodes in both views.
 */
export const EXHIBITIONS_NODE_SIZE_PX = 8;

/** Corner radius for Sankey rects and timeline markers (`rx` / `ry`). */
export const EXHIBITIONS_NODE_RX_PX = 1;
