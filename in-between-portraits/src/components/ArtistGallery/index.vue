<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import {
  artistPointsRows,
  artistWordRows,
  institutionWordRows,
  artworks,
  artistsById,
  institutionsById,
  featuredQuotesByArtistId,
  artistClustersMap,
  institutionClustersMap,
  exhibitionClustersMap,
} from "../../data/index.js";
import {
  CLUSTER_KEYWORDS_TO_SHOW,
  CLUSTER_MIN_ASSOCIATION_WEIGHT,
  CLUSTER_PRIMARY_LINE_GAP,
} from "../../constants.js";
import { publicImgSrc } from "../../utils/public-img-src.js";
import { parseYear } from "../../utils/parse-year.js";
import ArtistDot from "../ArtistDot/index.vue";

const props = defineProps({
  // Array of artist ids the gallery should aggregate. Single-artist callers
  // pass `[id]`. Multi-artist (cluster) callers can pass several ids; the
  // component combines all enriched points into one chronological timeline.
  artistIds: { type: Array, required: true },
  // When opening a multi-artist cluster, the cluster's featured_quote object
  // from cluster summary JSON (e.g. artist_cluster_summary): group featured_quote { source_idx, point, text }.
  // Takes precedence over the single-artist CSV lookup.
  clusterFeaturedQuote: { type: Object, default: null },
  // When opening an exhibition cluster, show the exhibition name as the hero
  // (no quotes) with location + year as attribution.
  // Shape: { name, location, year }
  exhibitionHero: { type: Object, default: null },
  // Filter to show only cluster-relevant points.
  // { type: "cluster", viewMode: "artist"|"institution", clusterId: Number, n: Number }
  // { type: "exhibition", year: Number|null }
  // null → no filter (single-artist dot click, show everything)
  pointFilter: { type: Object, default: null },
  // View mode active when this modal was opened ('artist' | 'institution' | 'exhibitions').
  // Determines which actor row appears first in the keyword summary.
  sourceMode: { type: String, default: null },
});

const emit = defineEmits(["pastHeroChange"]);
const FEATURED_TEXT_MAX_YEAR_GAP = 5;

// ---------- enrichment ----------

const artistWordsById = new Map(
  artistWordRows.map((row) => [String(row.id), row]),
);
const institutionWordsById = new Map(
  institutionWordRows.map((row) => [String(row.id), row]),
);

function formatYearOnly(rawDate) {
  const year = parseYear(rawDate);
  return Number.isFinite(year) ? String(year) : "";
}

function findArtistSlice(rawId) {
  const id = Number(rawId);
  if (!Number.isFinite(id)) return null;
  return (
    artistPointsRows.find((row) => Number(row.artist_id) === id) ||
    artistPointsRows.find((row) => Number(row.artist_id) === id - 1) ||
    null
  );
}

function lookupName(map, ...ids) {
  for (const id of ids) {
    const name = map.value[String(id ?? "")]?.name;
    if (name) return name;
  }
  return "";
}

function resolveInstitutionName(...ids) {
  return lookupName(institutionsById, ...ids) || "Institution";
}

function resolveArtistName(rawId) {
  return lookupName(artistsById, rawId, Number(rawId) - 1) || String(rawId);
}

// ---------- predicates (used by enrichment + featured-slot resolvers) ----------

function isArtistArtwork(point) {
  return Boolean(point && point.isArtwork && point.sourceActor === "artist");
}

function hasText(point) {
  return Boolean(point && point.text && String(point.text).trim());
}


const enrichedPoints = computed(() => {
  const artworkById = new Map(
    artworks.value.map((art) => [String(art.id), art]),
  );
  const out = [];

  props.artistIds.forEach((rawId) => {
    const slice = findArtistSlice(rawId);
    if (!slice) return;
    const artistName = resolveArtistName(rawId);

    slice.points.forEach((point, idx) => {
      const sourceIdx = String(point.source_idx || "").trim();
      const sourceActor = String(point.source_actor || "artist");
      const institutionId =
        point.institution_id == null ? "" : String(point.institution_id);
      const isInstitutionSource = sourceActor === "institution";
      const isArtwork = Boolean(point.is_artwork);

      const base = {
        pointKey: `g-${rawId}-${sourceIdx}-${idx}`,
        id: String(point.id ?? ""),
        artistId: String(rawId),
        sourceIdx,
        sourcePointOrder: idx,
        sourceActor,
        isArtwork,
        text: point.text || "",
        clusterByN: point.cluster_by_n ?? null,
      };

      if (isArtwork) {
        const art = artworkById.get(sourceIdx);
        const plotDate = isInstitutionSource
          ? String(art?.date_acquired_or_updated || art?.date_created || "")
          : String(art?.date_created || "");
        out.push({
          ...base,
          date: plotDate,
          displayDate: isInstitutionSource
            ? formatYearOnly(plotDate) || "n.d."
            : plotDate || "n.d.",
          year: parseYear(plotDate),
          title: art?.title || base.text || sourceIdx,
          image_url: art?.image_url || "",
          sourceName: isInstitutionSource
            ? resolveInstitutionName(institutionId, art?.institution)
            : art?.artistName || artistName,
        });
        return;
      }

      const sourceRow = isInstitutionSource
        ? institutionWordsById.get(sourceIdx)
        : artistWordsById.get(sourceIdx);
      const date = String(sourceRow?.date || "");
      out.push({
        ...base,
        text: base.text || sourceRow?.text || "",
        date,
        displayDate: date || "n.d.",
        year: parseYear(date),
        sourceName: isInstitutionSource
          ? resolveInstitutionName(institutionId, sourceRow?.institution)
          : artistName,
      });
    });
  });

  return out;
});

/**
 * Unified hero data for the gallery hero section. Returns one of:
 *   { kind: "exhibition", name, location, year }
 *   { kind: "quote", text, artistName, year }
 *   null  — no hero rendered
 */
const heroData = computed(() => {
  // Exhibition cluster: show the exhibition name (no quotes) + location/year.
  if (props.exhibitionHero) {
    const { name, location, year } = props.exhibitionHero;
    if (!name) return null;
    return { kind: "exhibition", name, location: location || null, year: year || null };
  }
  // Multi-artist embedding cluster: use the cluster's featured_quote.
  if (props.clusterFeaturedQuote) {
    const cq = props.clusterFeaturedQuote;
    if (!cq.text) return null;
    const wordRow = artistWordsById.get(String(cq.source_idx || ""));
    const artistName = wordRow?.artist ? resolveArtistName(wordRow.artist) : "";
    // Year comes from the word row's date, not from the cluster JSON (which has no date field).
    const year = wordRow?.date ? parseYear(String(wordRow.date)) : null;
    return { kind: "quote", text: cq.text, artistName, year };
  }
  // Single-artist: look up via the featured_quotes CSV.
  if (props.artistIds.length !== 1) return null;
  const aid = String(props.artistIds[0]);
  const uuid =
    featuredQuotesByArtistId.get(aid) ||
    featuredQuotesByArtistId.get(String(Number(aid) - 1));
  if (!uuid) return null;
  const found = enrichedPoints.value.find((p) => p.id === uuid);
  if (!found) return null;
  return {
    kind: "quote",
    text: found.text,
    artistName: resolveArtistName(aid),
    year: parseYear(found.date) || found.year || null,
  };
});

// ---------- point filtering ----------

const displayPoints = computed(() => {
  const filter = props.pointFilter;
  if (!filter) return enrichedPoints.value;

  if (filter.type === "cluster") {
    const source = filter.viewMode === "institution" ? "institution" : "artist";
    return enrichedPoints.value.filter(
      (p) => p.clusterByN?.[source]?.[filter.n] === filter.clusterId,
    );
  }

  if (filter.type === "exhibition" && filter.year != null) {
    return enrichedPoints.value.filter(
      (p) => Number.isFinite(p.year) && p.year < filter.year,
    );
  }

  return enrichedPoints.value;
});

// ---------- chronological timeline ----------

const chronoPoints = computed(() => {
  const arr = displayPoints.value
    .filter((p) => Number.isFinite(p.year))
    .slice();
  arr.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    if (a.isArtwork !== b.isArtwork) return a.isArtwork ? -1 : 1;
    if (a.sourceActor !== b.sourceActor) {
      return a.sourceActor === "artist" ? -1 : 1;
    }
    return 0;
  });
  return arr.map((p, idx) => ({ ...p, idx }));
});

const yearBounds = computed(() => {
  const pts = chronoPoints.value;
  if (!pts.length) return { min: null, max: null };
  return { min: pts[0].year, max: pts[pts.length - 1].year };
});

// ---------- deterministic random positions ----------

function hash32(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function pickRange(rand, min, max) {
  return min + rand() * (max - min);
}

const FEATURED_ART_BLOCK = {
  minX: 32,
  maxX: 72,
  minY: 13,
  maxY: 63,
};

const FEATURED_TEXT_BLOCK = {
  minX: 20,
  maxX: 84,
  minY: 56,
  maxY: 72,
};

// Timeline bar (~72px) and empty space below the featured content are non-interactive.
const STAGE_BOTTOM_BLOCK = {
  minX: 0,
  maxX: 100,
  minY: 74,
  maxY: 100,
};


function expandRect(rect, padX = 0, padY = 0) {
  return {
    minX: Math.max(0, rect.minX - padX),
    maxX: Math.min(100, rect.maxX + padX),
    minY: Math.max(0, rect.minY - padY),
    maxY: Math.min(100, rect.maxY + padY),
  };
}

function isInBlockedStageAreas(xPct, yPct, blockedRects) {
  return blockedRects.some(
    (rect) =>
      xPct >= rect.minX &&
      xPct <= rect.maxX &&
      yPct >= rect.minY &&
      yPct <= rect.maxY,
  );
}

function pickScatterPosOutsideBlockedArea(rand, blockedRects) {
  for (let i = 0; i < 18; i++) {
    const xPct = pickRange(rand, 4, 96);
    const yPct = pickRange(rand, 8, 88);
    if (!isInBlockedStageAreas(xPct, yPct, blockedRects)) return { xPct, yPct };
  }
  const leftSide = rand() < 0.5;
  const xPct = leftSide ? pickRange(rand, 4, 20) : pickRange(rand, 84, 96);
  const yPct = pickRange(rand, 8, 88);
  return { xPct, yPct };
}

const canvasPositions = computed(() => {
  const map = new Map();
  const blocked = [FEATURED_ART_BLOCK, FEATURED_TEXT_BLOCK, STAGE_BOTTOM_BLOCK];
  chronoPoints.value.forEach((p) => {
    const rand = seededRandom(hash32(p.pointKey));
    const { xPct, yPct } = pickScatterPosOutsideBlockedArea(rand, blocked);
    map.set(p.pointKey, {
      x: xPct,
      y: yPct,
      rotate: pickRange(rand, -2, 2),
    });
  });
  return map;
});

const dotPositions = computed(() => {
  const map = new Map();
  const blocked = [
    expandRect(FEATURED_ART_BLOCK, 4, 4),
    expandRect(FEATURED_TEXT_BLOCK, 7, 6),
    STAGE_BOTTOM_BLOCK,
  ];
  chronoPoints.value.forEach((p) => {
    const rand = seededRandom(hash32(`dot-${p.pointKey}`));
    const { xPct, yPct } = pickScatterPosOutsideBlockedArea(rand, blocked);
    map.set(p.pointKey, {
      xPct,
      yPct,
      rotate: pickRange(rand, -6, 6),
    });
  });
  return map;
});

// ---------- per-source keyword summary ----------

function getClusterKeywords(clusterMap, artistId) {
  const list = clusterMap?.numClusters;
  if (!list?.length) return [];
  const seen = new Set();
  const keywords = [];
  for (const entry of list) {
    const artistEntry = entry.artists?.find((a) => Number(a.artistId) === artistId);
    if (!artistEntry) continue;
    const dist = artistEntry.clusterDistribution ?? {};
    const primaryId = Number(artistEntry.primaryGroup);
    const primaryWeight = Number(dist[String(primaryId)] ?? dist[primaryId] ?? 0);
    const primaryAssociations = Object.entries(dist)
      .map(([id, w]) => ({ clusterId: Number(id), weight: Number(w) }))
      .filter((a) => a.weight > CLUSTER_MIN_ASSOCIATION_WEIGHT && a.weight >= primaryWeight - CLUSTER_PRIMARY_LINE_GAP)
      .sort((a, b) => b.weight - a.weight);
    for (const { clusterId } of primaryAssociations) {
      const group = entry.groups?.find((g) => Number(g.id) === clusterId);
      for (const kw of (group?.keywords ?? []).slice(0, CLUSTER_KEYWORDS_TO_SHOW)) {
        if (!seen.has(kw)) {
          seen.add(kw);
          keywords.push(kw);
        }
      }
    }
  }
  return keywords;
}

function getExhibitionKeywords(exMap, artistId) {
  const artistEntry = exMap?.artists?.find((a) => Number(a.artistId) === artistId);
  if (!artistEntry?.exhibitionIds?.length) return [];
  const labels = [];
  for (const eid of artistEntry.exhibitionIds) {
    const ex = exMap.exhibitions?.find((e) => e.id === Number(eid));
    if (ex?.labels?.length) labels.push(...ex.labels);
  }
  return [...new Set(labels)];
}

function actorIconStyle(actor) {
  const src = actor === "artist" ? publicImgSrc("artist.svg") : publicImgSrc("institution.svg");
  return { maskImage: `url("${src}")`, WebkitMaskImage: `url("${src}")` };
}

const keywordRows = computed(() => {
  if (props.artistIds.length !== 1) return [];
  const artistId = Number(props.artistIds[0]);

  const sourceModeToActor = { artist: "artist", institution: "institution", exhibitions: "exhibition" };
  const clickedActor = sourceModeToActor[props.sourceMode] ?? "artist";
  const defaultOrder = ["artist", "institution", "exhibition"];
  const actorOrder = [clickedActor, ...defaultOrder.filter((a) => a !== clickedActor)];

  const byActor = {
    artist: getClusterKeywords(artistClustersMap, artistId),
    institution: getClusterKeywords(institutionClustersMap, artistId),
    exhibition: getExhibitionKeywords(exhibitionClustersMap, artistId),
  };

  return actorOrder
    .filter((actor) => byActor[actor].length)
    .map((actor) => ({ actor, keywords: byActor[actor] }));
});

// ---------- scroll-driven active index ----------

const SEGMENT_VH = 90; // each chrono point reserves ~90vh of scroll

const scrollRef = ref(null);
const heroRef = ref(null);
const activeIdx = ref(0); // fractional
const viewportH = ref(0);
const heroPx = ref(0);
const pinnedArtworkKey = ref(null); // set when user explicitly clicks a canvas artwork

function measureHero() {
  heroPx.value = heroRef.value ? heroRef.value.offsetHeight : 0;
}

let lastEmittedPastHero = null;
/** Notifies parent (modal chrome) when the featured hero is fully scrolled past. */
function syncPastHeroToParent() {
  const el = scrollRef.value;
  if (!el) return;
  let past;
  if (!heroData.value) {
    past = true;
  } else if (heroPx.value <= 0) {
    // Before layout, hero height is 0 so `scrollTop >= heroPx` would wrongly read "past".
    past = false;
  } else {
    past = el.scrollTop >= heroPx.value;
  }
  if (lastEmittedPastHero !== past) {
    lastEmittedPastHero = past;
    emit("pastHeroChange", past);
  }
}

/**
 * Map scrollTop → fractional active index. Index 0 is anchored to the moment
 * the gallery body's top reaches the viewport top (i.e. the hero is fully
 * scrolled past), so no scroll-driven motion happens while the hero is still
 * partially visible.
 */
function recomputeActive() {
  const el = scrollRef.value;
  if (!el) return;
  const vh = viewportH.value || el.clientHeight || window.innerHeight || 800;
  const segmentPx = (SEGMENT_VH / 100) * vh;
  const total = chronoPoints.value.length;
  if (!total) {
    activeIdx.value = 0;
    syncPastHeroToParent();
    return;
  }
  const offset = el.scrollTop - heroPx.value;
  const raw = offset / segmentPx;
  activeIdx.value = Math.max(0, Math.min(total - 1, raw));
  syncPastHeroToParent();
}

let rafScheduled = false;
function onScroll() {
  if (rafScheduled) return;
  rafScheduled = true;
  requestAnimationFrame(() => {
    rafScheduled = false;
    recomputeActive();
  });
}

let resizeObs = null;

onMounted(() => {
  if (!scrollRef.value) return;
  viewportH.value = scrollRef.value.clientHeight;
  measureHero();
  scrollRef.value.addEventListener("scroll", onScroll, { passive: true });
  resizeObs = new ResizeObserver(() => {
    if (scrollRef.value) viewportH.value = scrollRef.value.clientHeight;
    measureHero();
    recomputeActive();
  });
  resizeObs.observe(scrollRef.value);
  if (heroRef.value) resizeObs.observe(heroRef.value);
  recomputeActive();
});

onBeforeUnmount(() => {
  if (scrollRef.value) {
    scrollRef.value.removeEventListener("scroll", onScroll);
  }
  if (resizeObs) {
    resizeObs.disconnect();
    resizeObs = null;
  }
  lastEmittedPastHero = null;
});

// Hero is conditionally rendered (depends on async-loaded data); re-observe
// and re-measure whenever it appears so the scroll math stays accurate.
watch(
  () => heroData.value,
  async () => {
    await nextTick();
    measureHero();
    if (resizeObs && heroRef.value) resizeObs.observe(heroRef.value);
    recomputeActive();
  },
);

// Clear the pinned artwork when the user scrolls more than 1.5 segments away from it.
watch(activeIdx, (newIdx) => {
  if (!pinnedArtworkKey.value) return;
  const pinned = chronoPoints.value.find((p) => p.pointKey === pinnedArtworkKey.value);
  if (!pinned || Math.abs(pinned.idx - newIdx) > 1.5) {
    pinnedArtworkKey.value = null;
  }
});

// ---------- featured slot resolution ----------

const activeIdxRounded = computed(() => Math.round(activeIdx.value));
const activePoint = computed(() => {
  const pts = chronoPoints.value;
  return pts[activeIdxRounded.value] || null;
});

/**
 * Walk backward from `cutoff` for the most recent point matching `predicate`.
 * Falls back to the first matching point in the timeline so the slot stays
 * populated before the user has scrolled into a matching point. Institution-
 * source `is_artwork` points are treated as text-only (their image is never
 * featured) — see `isArtistArtwork`.
 */
function findLatestWithFallback(pts, cutoff, predicate) {
  if (!pts.length) return null;
  for (let i = cutoff; i >= 0; i--) {
    if (predicate(pts[i])) return pts[i];
  }
  return pts.find(predicate) || null;
}

// Artwork is resolved first; in multi-artist mode the text slot then
// follows the artwork's artist so both slots always stay in sync.
const featuredArtwork = computed(() => {
  const pts = chronoPoints.value;
  const cutoff = activeIdxRounded.value;
  if (pinnedArtworkKey.value) {
    const pinned = pts.find((p) => p.pointKey === pinnedArtworkKey.value);
    if (pinned) return pinned;
  }
  return findLatestWithFallback(pts, cutoff, isArtistArtwork);
});

const featuredTextCandidate = computed(() => {
  const pts = chronoPoints.value;
  const cutoff = activeIdxRounded.value;
  const predicate = (p) => hasText(p) && !isArtistArtwork(p);
  if (props.artistIds.length > 1 && featuredArtwork.value) {
    const aid = featuredArtwork.value.artistId;
    return findLatestWithFallback(pts, cutoff, (p) => predicate(p) && p.artistId === aid);
  }
  return findLatestWithFallback(pts, cutoff, predicate);
});

function shouldShowFeaturedTextForArtwork(textPoint, artworkPoint) {
  if (!textPoint) return false;
  if (!artworkPoint) return true;
  if (!Number.isFinite(textPoint.year) || !Number.isFinite(artworkPoint.year)) {
    return true;
  }
  return Math.abs(textPoint.year - artworkPoint.year) <= FEATURED_TEXT_MAX_YEAR_GAP;
}

const featuredText = computed(() => {
  const textPoint = featuredTextCandidate.value;
  if (!textPoint) return null;
  if (activePoint.value?.pointKey === textPoint.pointKey) return textPoint;
  return shouldShowFeaturedTextForArtwork(textPoint, featuredArtwork.value)
    ? textPoint
    : null;
});

const featuredKeys = computed(() => {
  const set = new Set();
  if (featuredArtwork.value) set.add(featuredArtwork.value.pointKey);
  if (featuredText.value) set.add(featuredText.value.pointKey);
  return set;
});

/**
 * Timeline year matches the attribution on the featured text card
 * `(sourceName) (displayDate)` — i.e. `featuredText.year`. When no text
 * slot is shown, use the rounded scroll segment’s point so the bar still
 * tracks chronology.
 */
const activeYear = computed(() => {
  const text = featuredText.value;
  if (text && Number.isFinite(text.year)) return text.year;
  const pt = activePoint.value;
  if (pt && Number.isFinite(pt.year)) return pt.year;
  return null;
});

const timelineProgress = computed(() => {
  const { min, max } = yearBounds.value;
  if (min == null || max == null || max === min) return 0;
  if (activeYear.value == null) return 0;
  return Math.max(0, Math.min(1, (activeYear.value - min) / (max - min)));
});

// ---------- canvas item state ----------

const VISIBILITY_WINDOW = 6;

function canvasOpacity(idx) {
  const dist = Math.abs(idx - activeIdx.value);
  if (dist > VISIBILITY_WINDOW) return 0;
  return Math.max(0, 1 - dist / VISIBILITY_WINDOW) * 0.7;
}

function dotOpacity(idx) {
  if (idx === activeIdxRounded.value) return 1;
  const dist = Math.abs(idx - activeIdx.value);
  return Math.max(0.12, 0.7 - dist * 0.06);
}

function dotTransform(point) {
  const pos = dotPositions.value.get(point.pointKey);
  const rotate = pos ? pos.rotate : 0;
  return `translate(-50%, -50%) rotate(${rotate}deg)`;
}

// ---------- image fallback tracking ----------

const failedImageKeys = ref(new Set());

function shouldShowImage(point) {
  return Boolean(
    isArtistArtwork(point) &&
      point.image_url &&
      !failedImageKeys.value.has(point.pointKey),
  );
}

function handleImageError(pointKey) {
  const next = new Set(failedImageKeys.value);
  next.add(pointKey);
  failedImageKeys.value = next;
}

// ---------- navigation: smooth scroll to a point ----------

function scrollToIdx(idx, { behavior = "smooth" } = {}) {
  const el = scrollRef.value;
  if (!el) return;
  const vh = viewportH.value || el.clientHeight;
  const segmentPx = (SEGMENT_VH / 100) * vh;
  // Inverse of recomputeActive: scrollTop = heroPx + idx*segmentPx so that
  // landing on a point puts its segment exactly at the top of the viewport.
  const target = heroPx.value + idx * segmentPx;
  el.scrollTo({ top: Math.max(0, target), behavior });
}

function scrollToPoint(point) {
  scrollToIdx(point.idx, { behavior: "smooth" });
}

function clickCanvasArtwork(point) {
  pinnedArtworkKey.value = point.pointKey;
  scrollToPoint(point);
}

// ---------- timeline scrubbing ----------

const trackRef = ref(null);
let scrubbingPointerId = null;

function nearestIdxForYear(year) {
  const pts = chronoPoints.value;
  if (!pts.length) return 0;
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const d = Math.abs(pts[i].year - year);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function scrubToClientX(clientX) {
  const track = trackRef.value;
  if (!track) return;
  const { min, max } = yearBounds.value;
  if (min == null || max == null) return;
  const rect = track.getBoundingClientRect();
  if (rect.width <= 0) return;
  const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  const targetYear = min + fraction * (max - min);
  scrollToIdx(nearestIdxForYear(targetYear), { behavior: "auto" });
}

// Pointer capture can throw if the pointer is already gone; both call sites
// just want a best-effort capture/release.
function safePointerCapture(target, pointerId, action) {
  try {
    target[action](pointerId);
  } catch {
    /* ignore */
  }
}

function onTrackPointerDown(e) {
  if (!trackRef.value) return;
  scrubbingPointerId = e.pointerId;
  safePointerCapture(e.currentTarget, e.pointerId, "setPointerCapture");
  scrubToClientX(e.clientX);
}

function onTrackPointerMove(e) {
  if (scrubbingPointerId !== e.pointerId) return;
  scrubToClientX(e.clientX);
}

function onTrackPointerUp(e) {
  if (scrubbingPointerId !== e.pointerId) return;
  safePointerCapture(e.currentTarget, e.pointerId, "releasePointerCapture");
  scrubbingPointerId = null;
}

// ---------- derived render data ----------

const galleryBodyStyle = computed(() => {
  const h = viewportH.value || window?.innerHeight || 800;
  const segmentPx = (SEGMENT_VH / 100) * h;
  const n = Math.max(0, chronoPoints.value.length - 1);
  return { height: `${n * segmentPx + h}px` };
});

const canvasItems = computed(() =>
  chronoPoints.value.map((p) => ({
    point: p,
    pos: canvasPositions.value.get(p.pointKey),
  })),
);

const visibleDotPoints = computed(() =>
  chronoPoints.value.filter((point) => !isArtistArtwork(point)),
);


</script>

<template>
  <div class="artist-gallery-root">
    <div ref="scrollRef" class="artist-gallery-scroll">
      <section
        v-if="heroData"
        ref="heroRef"
        class="gallery-hero"
        :class="{ 'gallery-hero--keyword-border': keywordRows[0]?.actor === 'artist' }"
      >
        <!-- Exhibition hero: name as heading, no quote marks, location (year) attribution -->
        <template v-if="heroData.kind === 'exhibition'">
          <h2 class="gallery-hero__exhibition-name">{{ heroData.name }}</h2>
          <div class="gallery-hero__attribution">
            <template v-if="heroData.location">{{ heroData.location }}</template>
            <template v-if="heroData.year"> ({{ heroData.year }})</template>
          </div>
        </template>
        <!-- Quote hero: blockquote with artist name + year attribution -->
        <template v-else>
          <blockquote class="gallery-hero__quote">
            {{ heroData.text }}
          </blockquote>
          <div class="gallery-hero__attribution">
            <template v-if="heroData.artistName">{{ heroData.artistName }}</template>
            <template v-if="heroData.year"><template v-if="heroData.artistName">, </template>{{ heroData.year }}</template>
          </div>
        </template>
      </section>

      <section v-if="keywordRows.length" class="gallery-keyword-summary" aria-label="Source keywords">
        <div
          v-for="row in keywordRows"
          :key="row.actor"
          class="gallery-keyword-row"
          :class="`gallery-keyword-row--${row.actor}`"
        >
          <span class="gallery-keyword-row__icon" aria-hidden="true">
            <span v-if="row.actor === 'exhibition'" class="gallery-keyword-row__exhibition-node" />
            <span v-else class="gallery-keyword-row__mode-icon" :style="actorIconStyle(row.actor)" />
          </span>
          <span class="gallery-keyword-row__keyword label-text">{{ row.keywords.join(', ') }}</span>
        </div>
      </section>

      <div v-if="chronoPoints.length" class="gallery-body" :style="galleryBodyStyle">
        <div class="gallery-stage">
          <!-- background canvas: non-featured artist artworks (with image) only -->
          <div class="gallery-canvas" aria-hidden="true">
            <template v-for="{ point, pos } in canvasItems" :key="point.pointKey">
              <button
                v-if="shouldShowImage(point)"
                v-show="!featuredKeys.has(point.pointKey)"
                class="gallery-canvas-item"
                :style="{
                  left: pos.x + '%',
                  top: pos.y + '%',
                  transform: `translate(-50%, -50%) rotate(${pos.rotate}deg)`,
                  '--canvas-opacity': canvasOpacity(point.idx),
                  pointerEvents: canvasOpacity(point.idx) < 0.05 ? 'none' : 'auto',
                }"
                :tabindex="canvasOpacity(point.idx) < 0.05 ? -1 : 0"
                @click="clickCanvasArtwork(point)"
              >
                <img
                  :src="point.image_url"
                  :alt="point.title"
                  class="gallery-canvas-item__img"
                  @error="handleImageError(point.pointKey)"
                />
              </button>
            </template>
          </div>

          <!-- dots layer: encoded by source actor only -->
          <div class="gallery-dots-layer" aria-hidden="true">
            <button
              v-for="point in visibleDotPoints"
              :key="point.pointKey"
              class="gallery-dot"
              :class="[
                `gallery-dot--${point.sourceActor}`,
                {
                  'gallery-dot--active':
                    point.idx === activeIdxRounded,
                },
              ]"
              :style="{
                left: dotPositions.get(point.pointKey).xPct + '%',
                top: dotPositions.get(point.pointKey).yPct + '%',
                transform: dotTransform(point),
                '--dot-opacity': dotOpacity(point.idx),
              }"
              :title="point.displayDate"
              @click="scrollToPoint(point)"
            >
              <ArtistDot
                v-if="point.sourceActor === 'artist'"
                :artist-id="point.artistId"
              />
            </button>
          </div>

          <!-- center stage: featured artwork + single featured text -->
          <div class="gallery-stage-center">
            <Transition name="stage-fade" mode="out-in">
              <div
                v-if="featuredArtwork"
                :key="featuredArtwork.pointKey"
                class="gallery-featured-art"
              >
                <img
                  v-if="shouldShowImage(featuredArtwork)"
                  :src="featuredArtwork.image_url"
                  :alt="featuredArtwork.title"
                  class="gallery-featured-art__img"
                  @error="handleImageError(featuredArtwork.pointKey)"
                />
                <div
                  v-else
                  class="gallery-featured-art__placeholder gallery-featured-art__placeholder--fallback"
                ></div>
              </div>
            </Transition>

            <div v-if="featuredArtwork || featuredText" class="gallery-featured-label">
              <Transition name="stage-fade" mode="out-in">
                <div
                  v-if="featuredArtwork"
                  :key="featuredArtwork.pointKey"
                  class="gallery-featured-label__header"
                >
                  {{ featuredArtwork.title }}<template v-if="featuredArtwork.year"> ({{ featuredArtwork.year }})</template>
                </div>
              </Transition>
              <Transition name="stage-fade" mode="out-in">
                <div
                  v-if="featuredText"
                  :key="featuredText.pointKey"
                  class="gallery-featured-label__body"
                  :class="`gallery-featured-label__body--${featuredText.sourceActor}`"
                >
                  <div class="gallery-featured-label__text">{{ featuredText.text }}</div>
                  <div class="gallery-featured-label__attribution">
                    {{ featuredText.sourceName }} ({{ featuredText.displayDate }})
                  </div>
                </div>
              </Transition>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="yearBounds.min != null"
      class="gallery-timeline"
      role="slider"
      aria-label="Scrub timeline"
      :aria-valuemin="yearBounds.min"
      :aria-valuemax="yearBounds.max"
      :aria-valuenow="activeYear || yearBounds.min"
      @pointerdown="onTrackPointerDown"
      @pointermove="onTrackPointerMove"
      @pointerup="onTrackPointerUp"
      @pointercancel="onTrackPointerUp"
    >
      <div ref="trackRef" class="gallery-timeline__track">
        <div
          class="gallery-timeline__progress"
          :style="{ width: timelineProgress * 100 + '%' }"
        ></div>
      </div>
      <div class="gallery-timeline__labels">
        <span>{{ yearBounds.min }}</span>
        <span>{{ yearBounds.max }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped src="./style.css"></style>
