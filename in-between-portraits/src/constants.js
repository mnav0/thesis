export const FONT_SANS = '"Kosugi", sans-serif';

/** Diameter in px for artist dots/points used across intro, clusters, sankey, and travel overlay. */
export const DOT_SIZE_PX = 14;

/** Cluster art mode: thumbnail / hit box diameter relative to `DOT_SIZE_PX`. */
export const CLUSTER_ART_MODE_DOT_SCALE = 4;
export const CLUSTER_ART_MODE_DOT_SIZE_PX = DOT_SIZE_PX * CLUSTER_ART_MODE_DOT_SCALE;

/**
 * Artist id for the generic “persona” silhouette: actors preview, floating persona,
 * persona section, cluster key legend, etc. Matches `src/assets/artist-dots/<id>.svg`.
 */
export const REPRESENTATIVE_PERSONA_ARTIST_ID = 18;
