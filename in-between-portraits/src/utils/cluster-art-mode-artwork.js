/** Max distinct image URLs to try per artist (first load + retries). */
export const ART_MODE_IMAGE_MAX_ATTEMPTS = 3;

export function normalizeImageUrl(url) {
  if (url == null) return null;
  const s = String(url).trim();
  return s.length ? s : null;
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}

function artistKeyFromRow(row) {
  const raw = row?.artist;
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * Distinct normalized image URLs for one artist, shuffled, capped at ART_MODE_IMAGE_MAX_ATTEMPTS.
 * @param {Array<Record<string, unknown>>} artworksList
 * @param {number|string|null|undefined} artistId
 * @returns {string[]}
 */
export function getArtworkImageCandidatesForArtist(artworksList, artistId) {
  if (artistId == null || artistId === "") return [];
  const target = Number(artistId);
  if (!Number.isFinite(target)) return [];

  const seen = new Set();
  const unique = [];
  for (const row of artworksList ?? []) {
    if (artistKeyFromRow(row) !== target) continue;
    const u = normalizeImageUrl(row.image_url);
    if (!u || seen.has(u)) continue;
    seen.add(u);
    unique.push(u);
  }

  shuffleInPlace(unique);
  return unique.slice(0, ART_MODE_IMAGE_MAX_ATTEMPTS);
}

/**
 * @param {Array<Record<string, unknown>>} artworksList
 * @param {Iterable<number|string>} artistIds
 * @returns {Map<number, string[]>}
 */
export function buildArtModeCandidatesByArtistId(artworksList, artistIds) {
  const map = new Map();
  for (const rawId of artistIds) {
    if (rawId == null || rawId === "") continue;
    const id = Number(rawId);
    if (!Number.isFinite(id) || map.has(id)) continue;
    map.set(id, getArtworkImageCandidatesForArtist(artworksList, id));
  }
  return map;
}

/** Unique artist ids that appear anywhere in the artworks table. */
export function artistIdsFromArtworksRows(artworksList) {
  const ids = new Set();
  for (const row of artworksList ?? []) {
    const id = artistKeyFromRow(row);
    if (id != null) ids.add(id);
  }
  return [...ids];
}

/**
 * Shuffled URL lists for every artist in `artworksList`, once per call.
 * Use a single call per page session so cluster view / shuffle / art toggle do not re-roll images.
 */
export function buildSessionArtModeCandidateMap(artworksList) {
  return buildArtModeCandidatesByArtistId(
    artworksList,
    artistIdsFromArtworksRows(artworksList),
  );
}
