/** Uppercase labels, keys, tags */
export const FONT_LABEL = '"Kosugi", sans-serif';

/** Body text, tooltips, captions — swap this string to change all mixed-case text. */
export const FONT_BODY = '"Kosugi", sans-serif';

/** @deprecated use FONT_BODY or FONT_LABEL */
export const FONT_SANS = FONT_BODY;

/** Type scale in px (assumes 16px base) — mirrors --text-* CSS custom properties. */
export const FONT_SIZE_BODY_PX = 20;
export const FONT_SIZE_UI_PX = 16;
export const FONT_SIZE_KEY_PX = 12;

/** Diameter in px for artist dots/points used across clusters, sankey, and travel overlay. */
export const DOT_SIZE_PX = 18;

/** Cluster art mode: thumbnail / hit box diameter relative to `DOT_SIZE_PX`. */
export const CLUSTER_ART_MODE_DOT_SCALE = 4;
export const CLUSTER_ART_MODE_DOT_SIZE_PX = DOT_SIZE_PX * CLUSTER_ART_MODE_DOT_SCALE;

/**
 * Artist id for the generic “persona” silhouette: actors preview, floating persona,
 * persona section, cluster key legend, etc. Matches `src/assets/artist-dots/<id>.svg`.
 */
export const REPRESENTATIVE_PERSONA_ARTIST_ID = 18;
