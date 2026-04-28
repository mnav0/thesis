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
} from "../../data/index.js";
import { parseYear } from "../../utils/parse-year.js";
import ArtistDot from "../ArtistDot/index.vue";

const props = defineProps({
  // Array of artist ids the gallery should aggregate. Single-artist callers
  // pass `[id]`. Multi-artist (cluster) callers can pass several ids; the
  // component combines all enriched points into one chronological timeline.
  artistIds: { type: Array, required: true },
  // When opening a multi-artist cluster, the cluster's featured_quote object
  // from artist_cluster_positions.json: { source_idx, point, text }.
  // Takes precedence over the single-artist CSV lookup.
  clusterFeaturedQuote: { type: Object, default: null },
  // When opening an exhibition cluster, show the exhibition name as the hero
  // (no quotes) with location + year as attribution.
  // Shape: { name, location, year }
  exhibitionHero: { type: Object, default: null },
});

const emit = defineEmits(["pastHeroChange"]);

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
        sourceActor,
        isArtwork,
        text: point.text || "",
      };

      if (isArtwork) {
        const art = artworkById.get(sourceIdx);
        const plotDate =
          String(art?.date_created || "") ||
          String(art?.date_acquired_or_updated || "");
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

// ---------- chronological timeline ----------

const chronoPoints = computed(() => {
  const arr = enrichedPoints.value
    .filter((p) => Number.isFinite(p.year))
    .slice();
  arr.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    // artwork ties precede text ties (so artwork shows first when years match)
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

const canvasPositions = computed(() => {
  const map = new Map();
  chronoPoints.value.forEach((p) => {
    const rand = seededRandom(hash32(p.pointKey));
    // ~78% on the left band, the rest on a smaller right-of-center band so
    // the canvas mostly hugs the left side and leaves room for the dots.
    const onLeft = rand() < 0.78;
    map.set(p.pointKey, {
      x: onLeft ? pickRange(rand, 2, 22) : pickRange(rand, 58, 70),
      y: pickRange(rand, 8, 80),
      rotate: pickRange(rand, -2, 2),
    });
  });
  return map;
});

const dotPositions = computed(() => {
  const map = new Map();
  chronoPoints.value.forEach((p) => {
    const rand = seededRandom(hash32(`dot-${p.pointKey}`));
    const xPct = pickRange(rand, 6, 88);
    const jitterY = pickRange(rand, -22, 22);
    map.set(p.pointKey, { xPct, jitterY });
  });
  return map;
});

// ---------- scroll-driven active index ----------

const SEGMENT_VH = 90; // each chrono point reserves ~90vh of scroll

const scrollRef = ref(null);
const heroRef = ref(null);
const activeIdx = ref(0); // fractional
const viewportH = ref(0);
const heroPx = ref(0);

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

// ---------- featured slot resolution ----------

const activeIdxRounded = computed(() => Math.round(activeIdx.value));

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

const featuredText = computed(() =>
  findLatestWithFallback(
    chronoPoints.value,
    activeIdxRounded.value,
    hasText,
  ),
);

const featuredArtwork = computed(() => {
  const pts = chronoPoints.value;
  const textPoint = featuredText.value;
  // When multiple artists are present, constrain the artwork to the same
  // artist as the active text point so they are always paired together.
  if (textPoint && props.artistIds.length > 1) {
    const aid = textPoint.artistId;
    return findLatestWithFallback(
      pts,
      activeIdxRounded.value,
      (p) => isArtistArtwork(p) && p.artistId === aid,
    );
  }
  return findLatestWithFallback(pts, activeIdxRounded.value, isArtistArtwork);
});

const featuredKeys = computed(() => {
  const set = new Set();
  if (featuredArtwork.value) set.add(featuredArtwork.value.pointKey);
  if (featuredText.value) set.add(featuredText.value.pointKey);
  return set;
});

const activePoint = computed(() => {
  const pts = chronoPoints.value;
  return pts[activeIdxRounded.value] || null;
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
  // smooth fall-off so far-from-center dots fade out at the column edges
  return Math.max(0.12, 0.7 - dist * 0.06);
}

const VERTICAL_SPACING_PX = 58;

function dotTransform(point) {
  const pos = dotPositions.value.get(point.pointKey);
  const offsetY =
    (point.idx - activeIdx.value) * VERTICAL_SPACING_PX +
    (pos ? pos.jitterY : 0);
  return `translate3d(0, ${offsetY}px, 0)`;
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

const galleryBodyStyle = computed(() => ({
  height: `${chronoPoints.value.length * SEGMENT_VH}vh`,
}));

const canvasItems = computed(() =>
  chronoPoints.value.map((p) => ({
    point: p,
    pos: canvasPositions.value.get(p.pointKey),
  })),
);
</script>

<template>
  <div class="artist-gallery-root">
    <div ref="scrollRef" class="artist-gallery-scroll">
      <section v-if="heroData" ref="heroRef" class="gallery-hero">
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
                :title="point.displayDate"
                @click="scrollToPoint(point)"
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
              v-for="point in chronoPoints"
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

            <Transition name="stage-fade" mode="out-in">
              <article
                v-if="featuredText"
                :key="featuredText.pointKey"
                class="gallery-featured-text"
                :class="`gallery-featured-text--${featuredText.sourceActor}`"
              >
                <div class="gallery-featured-text__body">
                  {{ featuredText.text }}
                </div>
                <div class="gallery-featured-text__attribution">
                  {{ featuredText.sourceName }} ({{ featuredText.displayDate }})
                </div>
              </article>
            </Transition>
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
