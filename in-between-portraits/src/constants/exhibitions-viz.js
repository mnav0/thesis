/** Shared geometry + styling config for exhibition timeline/sankey visuals. */
export const EXHIBITIONS_VIZ_CONFIG = {
  layout: {
    /** Same inset as Sankey `extent` / inner plot band. */
    margin: {
      top: 12,
      right: 220,
      bottom: 12,
      left: 236,
    },
    /**
     * Sankey node column thickness (`nodeWidth`) and timeline markers (square w × h).
     * Change this single value to resize nodes in both views.
     */
    nodeSizePx: 8,
    /** Corner radius for Sankey rects and timeline markers (`rx` / `ry`). */
    nodeRadiusPx: 1,
    /**
     * Shared scale factor for exhibition rectangle heights across timeline and Sankey.
     * Heights remain proportional to artist count while matching between both views.
     */
    markHeightPerArtistPx: 6,
  },
  stroke: {
    /** Sankey links and timeline baseline stroke (px). */
    linkPx: 1.1,
  },
};

export function exhibitionMarkHeightPx(artistCount) {
  const count = Number.isFinite(artistCount) ? artistCount : 0;
  return Math.max(
    EXHIBITIONS_VIZ_CONFIG.layout.nodeSizePx,
    count * EXHIBITIONS_VIZ_CONFIG.layout.markHeightPerArtistPx,
  );
}
