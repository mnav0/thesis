<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { DOT_SIZE_PX, ARTWORK_SIZE } from "../../constants.js";
import { createTooltip } from "../../utils/d3/tooltip.js";
import ArtistDot from "../ArtistDot/index.vue";
import {
  artistPointsRows,
  artistWordRows,
  institutionWordRows,
  artworks,
  artistsById,
  institutionsById,
} from "../../data/index.js";

const props = defineProps({
  artistId: { type: [String, Number], required: true },
});

const rootRef = ref(null);
const failedArtworkPointKeys = ref(new Set());

const pointSize = Math.max(6, Math.round((DOT_SIZE_PX / 2) * 1.5));
const artworkSquareSizePx = Math.max(pointSize + 4, 12);
const artworkSizePx = Math.max(260, Math.round(ARTWORK_SIZE * 3.2));
const DEFAULT_CANVAS_HEIGHT_PX = 700;

const artistWordsById = new Map(artistWordRows.map((row) => [String(row.id), row]));
const institutionWordsById = new Map(
  institutionWordRows.map((row) => [String(row.id), row]),
);

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

function normalizeArtistId(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

const activeArtistSlice = computed(() => {
  const id = normalizeArtistId(props.artistId);
  if (id == null) return null;
  const exact = artistPointsRows.find((row) => Number(row.artist_id) === id);
  if (exact) return exact;
  return artistPointsRows.find((row) => Number(row.artist_id) === id - 1) || null;
});

const selectedPoints = computed(() => activeArtistSlice.value?.points || []);

function parseYear(rawDate) {
  const text = String(rawDate || "").trim();
  if (!text) return null;
  const match = text.match(/\b(1[6-9]\d{2}|20\d{2}|2100)\b/);
  if (!match) return null;
  const year = Number(match[1]);
  return Number.isFinite(year) ? year : null;
}

function formatYearOnly(rawDate) {
  const year = parseYear(rawDate);
  return Number.isFinite(year) ? String(year) : "";
}

const enrichedPoints = computed(() => {
  const artworkById = new Map(artworks.value.map((art) => [String(art.id), art]));
  const artistIdStr = String(props.artistId);
  const artistName =
    artistsById.value[artistIdStr]?.name ||
    artistsById.value[String(Number(artistIdStr) - 1)]?.name ||
    artistIdStr;
  return selectedPoints.value
    .map((point, idx) => {
      const sourceIdx = String(point.source_idx || "").trim();
      const sourceActor = String(point.source_actor || "artist");
      const institutionId =
        point.institution_id == null ? "" : String(point.institution_id);
      const sourceRow =
        sourceActor === "institution"
          ? institutionWordsById.get(sourceIdx)
          : artistWordsById.get(sourceIdx);
      const base = {
        pointKey: `flat-${sourceIdx}-${idx}`,
        sourceIdx,
        sourceActor,
        text: point.text || "",
        institutionId,
        isArtwork: Boolean(point.is_artwork),
      };

      if (base.isArtwork) {
        const art = artworkById.get(sourceIdx);
        const institutionName =
          institutionsById.value[institutionId]?.name ||
          institutionsById.value[String(art?.institution || "")]?.name ||
          "Institution";
        const createdDate = String(art?.date_created || "");
        const acquiredDate = String(art?.date_acquired_or_updated || "");
        const hasImage = Boolean(String(art?.image_url || "").trim());
        const isInstitutionSource = sourceActor === "institution";
        const renderType = isInstitutionSource
          ? "artwork_institution_square"
          : hasImage
            ? "artwork_artist_image"
            : "artwork_artist_fallback";
        const plotDate = createdDate || acquiredDate;

        return {
          ...base,
          renderType,
          date: plotDate,
          displayDate: isInstitutionSource
            ? formatYearOnly(plotDate) || "n.d."
            : plotDate || "n.d.",
          year: parseYear(plotDate),
          title: art?.title || point.text || sourceIdx,
          image_url: art?.image_url || "",
          text: base.text || art?.description || "",
          sourceName: isInstitutionSource
            ? institutionName
            : art?.artistName || artistName,
          url: "",
        };
      }

      const date = String(sourceRow?.date || "");
      const sourceName =
        sourceActor === "institution"
          ? institutionsById.value[institutionId]?.name ||
            institutionsById.value[String(sourceRow?.institution || "")]?.name ||
            "Institution"
          : artistName;

      return {
        ...base,
        renderType:
          sourceActor === "institution"
            ? "text_institution_dot"
            : "text_artist_dot",
        date,
        displayDate: date || "n.d.",
        year: parseYear(date),
        sourceName,
        text: base.text || sourceRow?.text || "",
        url: sourceActor === "artist" ? String(sourceRow?.source_url || "") : "",
      };
    })
    .filter(Boolean);
});


function placePoints(points, clusterId) {
  const artworkLanePoints = points.filter((point) =>
    ["artwork_artist_image", "artwork_artist_fallback"].includes(point.renderType),
  );
  const textLanePoints = points.filter((point) =>
    ["text_artist_dot", "text_institution_dot", "artwork_institution_square"].includes(
      point.renderType,
    ),
  );
  const allYears = points
    .map((point) => point.year)
    .filter((year) => Number.isFinite(year))
    .sort((a, b) => a - b);
  const uniqueYears = [...new Set(allYears)];
  const edgePad = 0.06;
  const textLane = { min: 0.06, max: 0.24 };
  const artworkLane = { min: 0.31, max: 0.96 };
  const artworkColumns = [0.39, 0.7];
  const topPadPx = 12;
  const orderedYearGapPx = 42;
  const artworkRowGapPx = 16;
  const fallbackYearGap = Math.max(72, artworkSizePx * 0.45);

  function clamp01(value) {
    return Math.max(0.02, Math.min(0.98, value));
  }

  const artworkCountsByYear = new Map();
  artworkLanePoints.forEach((point) => {
    if (!Number.isFinite(point.year)) return;
    artworkCountsByYear.set(point.year, (artworkCountsByYear.get(point.year) || 0) + 1);
  });

  const artworkRowsByYear = new Map();
  uniqueYears.forEach((year) => {
    const count = artworkCountsByYear.get(year) || 0;
    const rows = Math.max(1, Math.ceil(count / 2));
    artworkRowsByYear.set(year, rows);
  });

  const yearAnchorsPx = new Map();
  const yearBandsPx = new Map();
  let currentY = topPadPx;
  uniqueYears.forEach((year, index) => {
    const artworkRows = artworkRowsByYear.get(year) || 1;
    if (index > 0) currentY += orderedYearGapPx;
    const yearStart = currentY;
    yearAnchorsPx.set(year, yearStart);
    // Ordered layout: artworks define how much vertical room a year consumes.
    currentY += artworkRows * artworkSizePx + Math.max(0, artworkRows - 1) * artworkRowGapPx;
    yearBandsPx.set(year, { start: yearStart, end: currentY });
  });

  let unknownYCursor = currentY + 28;
  const textPlaced = [];
  const artworkPlaced = [];
  const VIRTUAL_CANVAS_WIDTH_PX = 1000;

  function textPointRadiusPx(point) {
    return point.renderType === "artwork_institution_square"
      ? Math.max(artworkSquareSizePx * 0.75, 8)
      : Math.max(pointSize * 0.65, 5);
  }

  const textYearGroups = new Map();
  textLanePoints.forEach((point) => {
    const yearKey = Number.isFinite(point.year) ? `y-${point.year}` : `unknown-${point.pointKey}`;
    if (!textYearGroups.has(yearKey)) textYearGroups.set(yearKey, []);
    textYearGroups.get(yearKey).push(point);
  });

  textYearGroups.forEach((groupPoints, yearKey) => {
    const placedInBand = [];
    groupPoints.forEach((point, idx) => {
      const seed = hash32(`${props.artistId}-${clusterId}-text-${yearKey}-${point.pointKey}-${idx}`);
      const rand = seededRandom(seed);
      let bandStart;
      let bandEnd;
      if (Number.isFinite(point.year) && yearBandsPx.has(point.year)) {
        const band = yearBandsPx.get(point.year);
        bandStart = band.start;
        bandEnd = band.end;
      } else {
        bandStart = unknownYCursor;
        unknownYCursor += fallbackYearGap;
        bandEnd = unknownYCursor;
      }

      const yPadding = 8;
      const safeStart = bandStart + yPadding;
      const safeEnd = Math.max(safeStart + 6, bandEnd - yPadding);
      const xPaddingNorm = 0.012;
      const minX = textLane.min + xPaddingNorm;
      const maxX = textLane.max - xPaddingNorm;
      const radiusPx = textPointRadiusPx(point);
      const xSpan = Math.max(0.0001, maxX - minX);
      const ySpan = Math.max(1, safeEnd - safeStart);

      let bestX = minX + rand() * xSpan;
      let bestY = safeStart + rand() * ySpan;
      let bestClearance = -Infinity;

      // Deterministic space-aware placement: sample candidates and pick the
      // first non-overlapping option, or fallback to max-clearance candidate.
      for (let attempt = 0; attempt < 36; attempt++) {
        const candidateX = minX + rand() * xSpan;
        const candidateY = safeStart + rand() * ySpan;
        let minClearance = Infinity;

        for (const other of placedInBand) {
          const dxPx = (candidateX - other.x) * VIRTUAL_CANVAS_WIDTH_PX;
          const dyPx = candidateY - other.yPx;
          const distPx = Math.sqrt(dxPx * dxPx + dyPx * dyPx);
          const neededPx = radiusPx + other.radiusPx + 3;
          minClearance = Math.min(minClearance, distPx - neededPx);
        }

        if (placedInBand.length === 0 || minClearance >= 0) {
          bestX = candidateX;
          bestY = candidateY;
          bestClearance = minClearance;
          break;
        }

        if (minClearance > bestClearance) {
          bestClearance = minClearance;
          bestX = candidateX;
          bestY = candidateY;
        }
      }

      textPlaced.push({
        ...point,
        x: clamp01(bestX),
        yPx: Math.max(topPadPx, bestY),
      });
      placedInBand.push({ x: bestX, yPx: bestY, radiusPx });
    });
  });

  const artworkYearGroups = new Map();
  artworkLanePoints.forEach((point) => {
    const yearKey = Number.isFinite(point.year) ? `y-${point.year}` : `unknown-${point.pointKey}`;
    if (!artworkYearGroups.has(yearKey)) artworkYearGroups.set(yearKey, []);
    artworkYearGroups.get(yearKey).push(point);
  });

  artworkYearGroups.forEach((groupPoints, yearKey) => {
    groupPoints.forEach((point, idx) => {
      const seed = hash32(
        `${props.artistId}-${clusterId}-art-${yearKey}-${point.pointKey}-${idx}`,
      );
      const rand = seededRandom(seed);
      const anchorY = Number.isFinite(point.year)
        ? yearAnchorsPx.get(point.year)
        : (unknownYCursor += fallbackYearGap);
      const colIndex = idx % 2;
      const rowIndex = Math.floor(idx / 2);
      const jitter = (rand() - 0.5) * 0.015;
      const laneSpan = artworkLane.max - artworkLane.min;
      const x =
        artworkLane.min + laneSpan * artworkColumns[colIndex] + jitter;
      const yPx = anchorY + rowIndex * (artworkSizePx + artworkRowGapPx) + artworkSizePx * 0.5;
      artworkPlaced.push({
        ...point,
        x: clamp01(x),
        yPx: Math.max(topPadPx, yPx),
      });
    });
  });

  const allPlaced = [...textPlaced, ...artworkPlaced];
  const maxPlacedY = allPlaced.reduce((maxY, point) => Math.max(maxY, point.yPx), currentY);
  const canvasHeightPx = Math.max(
    DEFAULT_CANVAS_HEIGHT_PX,
    Math.ceil(maxPlacedY + artworkSizePx * 0.75 + 76),
  );
  const normalizeY = (yPx) => clamp01(edgePad + (yPx / canvasHeightPx) * (1 - edgePad * 2));

  return {
    points: allPlaced.map((point) => ({
      ...point,
      y: normalizeY(point.yPx),
    })),
    canvasHeightPx,
  };
}

const layout = computed(() => {
  const points = enrichedPoints.value;
  return placePoints(points, "flat");
});

function tooltipHtml(point) {
  if (
    point.renderType === "artwork_artist_image" ||
    point.renderType === "artwork_artist_fallback"
  ) {
    return (
      `<div style='padding-bottom: 0.7em;'><b>${point.title}</b></div>` +
      `<div style='border-top: 1px solid #fff; margin-top: 0.7em; padding-top: 0.5em; font-size: 0.98em; color: #fff; text-align: right;'>${point.sourceName} (${point.displayDate || "n.d."})</div>`
    );
  }

  if (point.renderType === "artwork_institution_square") {
    return (
      `<div style='padding-bottom: 0.7em;'>${point.text || point.title || ""}</div>` +
      `<div style='border-top: 1px solid #111; margin-top: 0.7em; padding-top: 0.5em; font-size: 0.98em; color: #111; text-align: right;'>${point.sourceName} (${point.displayDate || "n.d."})</div>`
    );
  }

  const isArtistText = point.renderType === "text_artist_dot";
  const border = isArtistText ? "#fff" : "#111";
  const fg = isArtistText ? "#fff" : "#111";
  return (
    `<div style='padding-bottom: 0.7em;'>${point.text}</div>` +
    `<div style='border-top: 1px solid ${border}; margin-top: 0.7em; padding-top: 0.5em; font-size: 0.98em; color: ${fg}; text-align: right;'>${point.sourceName} (${point.displayDate || "n.d."})</div>`
  );
}

function setupTooltips() {
  const root = rootRef.value;
  if (!root) return;
  const { show, hide } = createTooltip(root);
  const pointEls = root.querySelectorAll("[data-cluster-point]");

  pointEls.forEach((el) => {
    if (el.dataset.tooltipBound === "1") return;
    const payload = el.dataset.payload;
    if (!payload) return;
    const point = JSON.parse(payload);
    el.dataset.tooltipBound = "1";

    el.addEventListener("mouseenter", (event) => {
      const isArtwork =
        point.renderType === "artwork_artist_image" ||
        point.renderType === "artwork_artist_fallback";
      const isArtistText = point.renderType === "text_artist_dot";
      show(event, {
        bg: isArtistText || isArtwork ? "#111" : "#fff",
        fg: isArtistText || isArtwork ? "#fff" : "#111",
        border: isArtistText || isArtwork ? "#fff" : "#111",
        html: tooltipHtml(point),
      });
    });
    el.addEventListener("mouseleave", () => hide());
  });
}

function handleArtworkImageError(pointKey) {
  failedArtworkPointKeys.value = new Set([
    ...failedArtworkPointKeys.value,
    pointKey,
  ]);
}

function handlePointClick(point) {
  if (point.renderType !== "text_artist_dot") return;
  if (!point.url) return;
  window.open(point.url, "_blank", "noopener,noreferrer");
}

onMounted(() => {
  setupTooltips();
});

watch(layout, () => {
  requestAnimationFrame(setupTooltips);
});

watch(
  () => props.artistId,
  () => {
    // Prevent stale image error keys from a previous artist suppressing valid images.
    failedArtworkPointKeys.value = new Set();
  },
);
</script>

<template>
  <div ref="rootRef" class="artist-cluster-grid-root">
    <div v-if="layout.points.length === 0" class="artist-cluster-grid-empty">
      No cluster points available for this artist.
    </div>
    <div v-else class="artist-cluster-grid">
      <div class="artist-cluster-cell__canvas" :style="{ height: `${layout.canvasHeightPx}px` }">
        <div class="artist-cluster-lane artist-cluster-lane--text" />
        <div class="artist-cluster-lane artist-cluster-lane--artwork" />

        <template v-for="point in layout.points" :key="point.pointKey">
          <button
            v-if="
              point.renderType === 'text_artist_dot' ||
              point.renderType === 'text_institution_dot' ||
              point.renderType === 'artwork_institution_square'
            "
            type="button"
            data-cluster-point
            class="artist-cluster-point artist-cluster-point--text"
            :class="{
              'artist-cluster-point--artist': point.renderType === 'text_artist_dot',
              'artist-cluster-point--institution': point.renderType === 'text_institution_dot',
              'artist-cluster-point--artist-link': point.renderType === 'text_artist_dot' && point.url,
              'artist-cluster-point--artwork-square': point.renderType === 'artwork_institution_square',
            }"
            :style="{
              left: `${point.x * 100}%`,
              top: `${point.y * 100}%`,
              width: `${point.renderType === 'artwork_institution_square' ? artworkSquareSizePx : pointSize}px`,
              height: `${point.renderType === 'artwork_institution_square' ? artworkSquareSizePx : pointSize}px`,
            }"
            :data-payload="JSON.stringify(point)"
            @click="handlePointClick(point)"
          >
            <ArtistDot
              v-if="point.renderType === 'text_artist_dot'"
              :artist-id="props.artistId"
            />
          </button>

          <img
            v-else-if="
              point.renderType === 'artwork_artist_image' &&
              point.image_url &&
              !failedArtworkPointKeys.has(point.pointKey)
            "
            data-cluster-point
            class="artist-cluster-point artist-cluster-point--artwork"
            :style="{
              left: `${point.x * 100}%`,
              top: `${point.y * 100}%`,
              width: `${artworkSizePx}px`,
              height: `${artworkSizePx}px`,
            }"
            :src="point.image_url"
            :alt="point.title"
            :data-payload="JSON.stringify(point)"
            @error="handleArtworkImageError(point.pointKey)"
          />
          <div
            v-else
            data-cluster-point
            class="artist-cluster-point artist-cluster-point--artwork-fallback"
            :style="{
              left: `${point.x * 100}%`,
              top: `${point.y * 100}%`,
              width: `${artworkSizePx}px`,
              height: `${artworkSizePx}px`,
            }"
            :data-payload="JSON.stringify(point)"
          />
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped src="./style.css"></style>
