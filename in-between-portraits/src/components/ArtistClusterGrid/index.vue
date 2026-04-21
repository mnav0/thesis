<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { DOT_SIZE_PX, ARTWORK_SIZE } from "../../constants.js";
import { createTooltip } from "../../utils/d3/tooltip.js";
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
  nClusters: { type: Number, default: null },
});

const rootRef = ref(null);
const failedArtworkPointKeys = ref(new Set());

const pointSize = Math.max(6, Math.round((DOT_SIZE_PX / 2) * 1.5));
const artworkMaxSize = Math.max(pointSize * 12, Math.round(ARTWORK_SIZE * 1.2));
const CANVAS_HEIGHT_PX = 220;
// TODO(precompute-layout): Replace runtime point placement with coordinates
// generated in a Python notebook. Flip this flag to `true` and return the
// precomputed coordinates branch in `renderedClusters` once available.
const USE_PRECOMPUTED_LAYOUT = false;

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

const selectedNValue = computed(() => {
  const nValues = activeArtistSlice.value?.n_values || [];
  if (!nValues.length) return null;
  const requested = Number(props.nClusters);
  if (!Number.isFinite(requested)) return nValues[0].n;

  let best = nValues[0];
  let bestDist = Math.abs(Number(best.n) - requested);
  for (const candidate of nValues) {
    const dist = Math.abs(Number(candidate.n) - requested);
    if (dist < bestDist) {
      best = candidate;
      bestDist = dist;
    }
  }
  return best.n;
});

const selectedClusters = computed(() => {
  const nValues = activeArtistSlice.value?.n_values || [];
  const targetN = selectedNValue.value;
  const chosen = nValues.find((entry) => Number(entry.n) === Number(targetN));
  return chosen?.clusters || [];
});

const enrichedClusters = computed(() => {
  const artworkById = new Map(artworks.value.map((art) => [String(art.id), art]));
  const artistIdStr = String(props.artistId);
  const artistName =
    artistsById.value[artistIdStr]?.name ||
    artistsById.value[String(Number(artistIdStr) - 1)]?.name ||
    artistIdStr;

  return selectedClusters.value.map((cluster) => {
    const points = (cluster.points || [])
      .map((point, idx) => {
        const sourceIdx = String(point.source_idx || "").trim();
        const sourceActor = String(point.source_actor || "artist");
        const base = {
          pointKey: `${cluster.cluster}-${sourceIdx}-${idx}`,
          sourceIdx,
          sourceActor,
          text: point.text || "",
          distanceToCenter: Number(point.distance_to_center || 0),
          institutionId:
            point.institution_id == null ? "" : String(point.institution_id),
          isArtwork: Boolean(point.is_artwork),
        };

        if (base.isArtwork) {
          const art = artworkById.get(sourceIdx);
          const institutionName =
            institutionsById.value[String(point.institution_id)]?.name ||
            institutionsById.value[String(art?.institution || "")]?.name ||
            "Institution";
          return {
            ...base,
            renderType:
              sourceActor === "artist" ? "artwork_image" : "artwork_square",
            date: art?.date_created || "",
            title: art?.title || sourceIdx,
            image_url: art?.image_url || "",
            sourceName:
              sourceActor === "institution"
                ? institutionName
                : art?.artistName || artistName,
            url: "",
          };
        }

        const sourceRow =
          sourceActor === "institution"
            ? institutionWordsById.get(sourceIdx)
            : artistWordsById.get(sourceIdx);

        const sourceName =
          sourceActor === "institution"
            ? institutionsById.value[String(point.institution_id)]?.name ||
              institutionsById.value[String(sourceRow?.institution || "")]?.name ||
              "Institution"
            : artistName;

        return {
          ...base,
          renderType: "text",
          date: String(sourceRow?.date || ""),
          sourceName,
          text: base.text || sourceRow?.text || "",
          url: sourceActor === "artist" ? String(sourceRow?.source_url || "") : "",
        };
      })
      .filter(Boolean);

    return {
      clusterId: cluster.cluster,
      points,
    };
  });
});

const dedupedClusters = computed(() => {
  const keepBySourceIdx = new Map();

  for (const cluster of enrichedClusters.value) {
    for (const point of cluster.points) {
      if (point.renderType !== "artwork_image") continue;
      const existing = keepBySourceIdx.get(point.sourceIdx);
      if (!existing || point.distanceToCenter < existing.distanceToCenter) {
        keepBySourceIdx.set(point.sourceIdx, point);
      }
    }
  }

  const keepPointKeys = new Set(
    Array.from(keepBySourceIdx.values()).map((point) => point.pointKey),
  );

  return enrichedClusters.value.map((cluster) => ({
    ...cluster,
    points: cluster.points.filter((point) => {
      if (point.renderType !== "artwork_image") return true;
      return keepPointKeys.has(point.pointKey);
    }),
  }));
});

function placePoints(points, clusterId) {
  const placed = [];
  const gap = 0.012;
  function clearanceAt(x, y, radiusNorm) {
    if (!placed.length) return Infinity;
    let minClearance = Infinity;
    for (const other of placed) {
      const dx = x - other.x;
      const dy = y - other.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const needed = radiusNorm + other.radiusNorm + gap;
      minClearance = Math.min(minClearance, dist - needed);
    }
    return minClearance;
  }

  function findBestAvailable(edgePad, radiusNorm) {
    let best = { x: 0.5, y: 0.5, clearance: -Infinity };
    const steps = 28;
    for (let gx = 0; gx < steps; gx++) {
      for (let gy = 0; gy < steps; gy++) {
        const x = edgePad + (gx / (steps - 1)) * (1 - edgePad * 2);
        const y = edgePad + (gy / (steps - 1)) * (1 - edgePad * 2);
        const clearance = clearanceAt(x, y, radiusNorm);
        if (clearance > best.clearance) {
          best = { x, y, clearance };
        }
      }
    }
    return best;
  }

  const sortedPoints = [...points].sort((a, b) => {
    // Place large artworks first so smaller dots route around them.
    if (a.renderType === b.renderType) return 0;
    if (a.renderType === "artwork_image") return -1;
    if (b.renderType === "artwork_image") return 1;
    return 0;
  });

  sortedPoints.forEach((point, idx) => {
    const seed = hash32(`${props.artistId}-${clusterId}-${point.pointKey}-${idx}`);
    const rand = seededRandom(seed);
    const radiusNorm =
      point.renderType === "artwork_image"
        ? Math.max(0.11, (artworkMaxSize / CANVAS_HEIGHT_PX) * 0.33)
        : point.renderType === "artwork_square"
          ? 0.024
          : 0.018;
    const edgePad =
      point.renderType === "artwork_image"
        ? 0.08
        : point.renderType === "artwork_square"
          ? 0.055
          : 0.045;
    let x = 0.5;
    let y = 0.5;
    let found = false;

    for (let tries = 0; tries < 220; tries++) {
      x = edgePad + rand() * (1 - edgePad * 2);
      y = edgePad + rand() * (1 - edgePad * 2);

      if (clearanceAt(x, y, radiusNorm) >= 0) {
        found = true;
        break;
      }
    }

    if (!found) {
      // Deterministic spiral fallback that still enforces collision checks.
      const t0 = rand() * Math.PI * 2;
      for (let step = 0; step < 260; step++) {
        const t = t0 + step * 0.35;
        const r = Math.min(0.45 - radiusNorm, 0.03 + step * 0.0018);
        x = Math.max(edgePad, Math.min(1 - edgePad, 0.5 + Math.cos(t) * r));
        y = Math.max(edgePad, Math.min(1 - edgePad, 0.5 + Math.sin(t) * r));

        if (clearanceAt(x, y, radiusNorm) >= 0) {
          found = true;
          break;
        }
      }
    }

    if (!found) {
      // Last-resort: choose point with best available clearance (min overlap).
      const best = findBestAvailable(edgePad, radiusNorm);
      x = best.x;
      y = best.y;
    }

    placed.push({
      ...point,
      x,
      y,
      radiusNorm,
    });
  });

  return placed;
}

const renderedClusters = computed(() =>
  USE_PRECOMPUTED_LAYOUT
    ? dedupedClusters.value
    : dedupedClusters.value.map((cluster) => ({
        ...cluster,
        points: placePoints(cluster.points, cluster.clusterId),
      })),
);

const gridStyle = computed(() => {
  const k = Math.max(1, renderedClusters.value.length);
  const cols = Math.ceil(Math.sqrt(k));
  return {
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
  };
});

function tooltipHtml(point) {
  if (point.renderType === "artwork_image") {
    return (
      `<div style='padding-bottom: 0.7em;'><b>${point.title}</b></div>` +
      `<div style='border-top: 1px solid #fff; margin-top: 0.7em; padding-top: 0.5em; font-size: 0.98em; color: #fff; text-align: right;'>${point.sourceName} (${point.date || "n.d."})</div>`
    );
  }

  const border = point.sourceActor === "artist" ? "#fff" : "#111";
  const fg = point.sourceActor === "artist" ? "#fff" : "#111";
  return (
    `<div style='padding-bottom: 0.7em;'>${point.text}</div>` +
    `<div style='border-top: 1px solid ${border}; margin-top: 0.7em; padding-top: 0.5em; font-size: 0.98em; color: ${fg}; text-align: right;'>${point.sourceName} (${point.date || "n.d."})</div>`
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
      const isArtistText = point.renderType === "text" && point.sourceActor === "artist";
      show(event, {
        bg: isArtistText || point.renderType === "artwork_image" ? "#111" : "#fff",
        fg: isArtistText || point.renderType === "artwork_image" ? "#fff" : "#111",
        border: isArtistText || point.renderType === "artwork_image" ? "#fff" : "#111",
        html: tooltipHtml(point),
      });
    });
    el.addEventListener("mouseleave", () => hide());
  });
}

function handleArtworkImageError(pointKey) {
  failedArtworkPointKeys.value.add(pointKey);
}

function handlePointClick(point) {
  if (point.renderType !== "text") return;
  if (point.sourceActor !== "artist") return;
  if (!point.url) return;
  window.open(point.url, "_blank", "noopener,noreferrer");
}

onMounted(() => {
  setupTooltips();
});

watch(renderedClusters, () => {
  requestAnimationFrame(setupTooltips);
});
</script>

<template>
  <div ref="rootRef" class="artist-cluster-grid-root">
    <div v-if="renderedClusters.length === 0" class="artist-cluster-grid-empty">
      No cluster points available for this artist.
    </div>
    <div v-else class="artist-cluster-grid" :style="gridStyle">
      <div v-for="cluster in renderedClusters" :key="cluster.clusterId" class="artist-cluster-cell">
        <div class="artist-cluster-cell__canvas">
          <template v-for="point in cluster.points" :key="point.pointKey">
            <button
              v-if="point.renderType === 'text' || point.renderType === 'artwork_square'"
              type="button"
              data-cluster-point
              class="artist-cluster-point artist-cluster-point--text"
              :class="{
                'artist-cluster-point--institution': point.sourceActor === 'institution',
                'artist-cluster-point--artist-link': point.sourceActor === 'artist' && point.url,
                'artist-cluster-point--artwork-square': point.renderType === 'artwork_square',
              }"
              :style="{
                left: `${point.x * 100}%`,
                top: `${point.y * 100}%`,
                width: `${pointSize}px`,
                height: `${pointSize}px`,
              }"
              :data-payload="JSON.stringify(point)"
              @click="handlePointClick(point)"
            />

            <img
              v-else-if="
                point.renderType === 'artwork_image' &&
                point.image_url &&
                !failedArtworkPointKeys.has(point.pointKey)
              "
              data-cluster-point
              class="artist-cluster-point artist-cluster-point--artwork"
              :style="{
                left: `${point.x * 100}%`,
                top: `${point.y * 100}%`,
                maxWidth: `${artworkMaxSize}px`,
                maxHeight: `${artworkMaxSize}px`,
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
                width: `${artworkMaxSize}px`,
                height: `${artworkMaxSize}px`,
              }"
              :data-payload="JSON.stringify(point)"
            />
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped src="./style.css"></style>
