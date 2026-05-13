/* Mirror :root in src/style.css (FONT_SIZE_*_PX, DOT_SIZE_PX, --tracking-*). */
export const FONT_LABEL = '"Kosugi", sans-serif';

export const FONT_BODY = '"Kosugi", sans-serif';

/** @deprecated use FONT_BODY or FONT_LABEL */
export const FONT_SANS = FONT_BODY;

export const FONT_SIZE_BODY_PX = 20; /* --text-body */
export const FONT_SIZE_UI_PX = 16; /* --text-ui */
export const FONT_SIZE_KEY_PX = 12; /* --text-key */

export const CSS_LETTER_SPACING_KEY = "var(--tracking-key)";
export const CSS_LETTER_SPACING_UI = "var(--tracking-ui)";
export const CSS_LETTER_SPACING_BODY = "var(--tracking-body)";
/** @deprecated use CSS_LETTER_SPACING_UI */
export const CSS_LETTER_SPACING_LABEL = CSS_LETTER_SPACING_UI;
/** @deprecated use CSS_LETTER_SPACING_BODY */
export const CSS_LETTER_SPACING_PROSE = CSS_LETTER_SPACING_BODY;

export const DOT_SIZE_PX = 18; /* --dot-size */

export const CLUSTER_ART_MODE_DOT_SCALE = 4;
export const CLUSTER_ART_MODE_DOT_SIZE_PX = DOT_SIZE_PX * CLUSTER_ART_MODE_DOT_SCALE; /* ClusterSection: --dot-size when art mode */

/** Persona silhouette asset: `artist-dots/{id}.svg`. */
export const REPRESENTATIVE_PERSONA_ARTIST_ID = 18;

export const CLUSTER_KEYWORDS_TO_SHOW = 1;

export const CLUSTER_MIN_ASSOCIATION_WEIGHT = 0.02;

export const CLUSTER_PRIMARY_LINE_GAP = 0.1;
