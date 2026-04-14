<script setup>
import {
  ref,
  computed,
  onMounted,
  onBeforeUnmount,
  nextTick,
  watch,
} from "vue";
import { artistsById } from "../../data/index.js";

const props = defineProps({
  exhibitions: { type: Array, default: () => [] },
  artistData: { type: Array, default: () => [] },
  institutionData: { type: Array, default: () => [] },
  artistPositions: { type: Array, default: () => [] },
  institutionPositions: { type: Array, default: () => [] },
  /** @type {'exhibitions' | 'artist' | 'institution'} */
  initialViewMode: {
    type: String,
    default: "exhibitions",
  },
  initialN: { type: Number, default: null },
});

const emit = defineEmits(["select-point", "select-cluster"]);
const containerWidth = ref(0)

const POINT_SIZE = 14;
const CLUSTER_RADIUS = 118;
const CANVAS_PADDING = 150;
const PACK_FALLBACK_W = 960;
const PACK_FALLBACK_H = 720;
const EXHIBITION_GRID_MARGIN = 0;

const viewMode = ref(
  ["exhibitions", "artist", "institution"].includes(props.initialViewMode)
    ? props.initialViewMode
    : "exhibitions",
);
const selectedNIndex = ref(0);

const sectionRef = ref(null);
const svgSize = ref({ width: 0, height: 0 });

const activeSummary = computed(() =>
  viewMode.value === "institution" ? props.institutionData : props.artistData,
);
const activePositions = computed(() =>
  viewMode.value === "institution"
    ? props.institutionPositions
    : props.artistPositions,
);

const availableN = computed(() => {
  if (viewMode.value === "exhibitions") return [];
  const data = activeSummary.value;
  if (!data?.length) return [];
  return [...new Set(data.map((d) => d.n))].sort((a, b) => a - b);
});

const selectedN = computed(() => availableN.value[selectedNIndex.value] ?? 0);

const sliderDisabled = computed(() => viewMode.value === "exhibitions");

watch(availableN, (vals) => {
  if (selectedNIndex.value >= vals.length) {
    selectedNIndex.value = Math.max(0, vals.length - 1);
  }
});

function applyInitialNIfNeeded() {
  if (props.initialN == null || viewMode.value === "exhibitions") return;
  const vals = availableN.value;
  if (vals.includes(props.initialN)) {
    selectedNIndex.value = vals.indexOf(props.initialN);
  }
}

const currentJsonRows = computed(
  () =>
    activeSummary.value?.filter((d) => d.n === selectedN.value) ?? [],
);

const currentPositionEntry = computed(() =>
  activePositions.value?.find((p) => p.n === selectedN.value),
);

const currentClusterPositions = computed(
  () => currentPositionEntry.value?.cluster_positions ?? {},
);

function normToCanvas(x, y) {
  const { width, height } = svgSize.value;
  return {
    x: CANVAS_PADDING + x * (width - CANVAS_PADDING * 2),
    y: CANVAS_PADDING + y * (height - CANVAS_PADDING * 2),
  };
}

function clampRefNorm01(v) {
  return Math.min(0.98, Math.max(0.02, Number(v) || 0.5));
}

/** Even grid in [margin, 1-margin]² for exhibition clusters. */
function exhibitionGridNormCell(k, index, aspectW, aspectH) {
  const margin = 0;
  const usable = 1 - 2 * margin;
  const a = Math.max(0.5, aspectW / Math.max(aspectH, 1));
  const cols = Math.max(1, Math.ceil(Math.sqrt(k * a)));
  const rows = Math.ceil(k / cols);
  const col = index % cols;
  const row = Math.floor(index / cols);
  return {
    nx: margin + usable * ((col + 0.5) / cols),
    ny: margin + usable * ((row + 0.5) / rows),
    rows,
    cols,
  };
}

function centerLabelsForJsonCluster(clusterId, rowsInCluster) {
  const row =
    rowsInCluster.find((r) => r.primary_cluster === clusterId) ??
    rowsInCluster[0];
  const kw = row?.cluster_keywords?.[String(clusterId)];
  if (Array.isArray(kw) && kw.length) return kw.slice(0, 2).map(String);
  return [];
}

/** Display label from artists.csv via reactive lookup (not JSON `artist_name`). */
function artistDisplayName(artistId) {
  const id = Number(artistId);
  if (Number.isNaN(id)) return `Artist ${artistId}`;
  return artistsById.value[id]?.name ?? `Artist ${id}`;
}

/** Match a display name to an artist id (institution rows list several names in one field). */
function artistIdForDisplayName(name) {
  const t = String(name).trim().toLowerCase();
  if (!t) return null;
  for (const [id, a] of Object.entries(artistsById.value)) {
    if (a?.name && String(a.name).trim().toLowerCase() === t) return +id;
  }
  return null;
}

function baseItemFromJsonRow(row, c) {
  const distKey = `avg_dist_to_cluster_${c}`;
  return {
    artistId: row.artist,
    artistName: artistDisplayName(row.artist),
    distanceToCenter: row[distKey] ?? 0.5,
    primaryCluster: c,
    closestOtherCluster: row.closest_cluster_by_dist,
    _angle: row._angle ?? 0,
    _radius_frac: row._radius_frac ?? 0.5,
  };
}

/**
 * Institution summaries may list multiple artists in `artist_name` (comma-separated);
 * we split to find ids, but labels always come from artists.csv.
 */
function jsonRowToDisplayItems(row, isInstitutionMode) {
  const c = row.primary_cluster;
  if (!isInstitutionMode) {
    return [baseItemFromJsonRow(row, c)];
  }
  const raw = row.artist_name;
  if (raw == null || !String(raw).includes(",")) {
    return [baseItemFromJsonRow(row, c)];
  }
  const names = String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (names.length <= 1) {
    return [baseItemFromJsonRow(row, c)];
  }
  const distKey = `avg_dist_to_cluster_${c}`;
  const dist = row[distKey] ?? 0.5;
  return names.map((name) => {
    const id = artistIdForDisplayName(name) ?? row.artist;
    return {
      artistId: id,
      artistName: artistDisplayName(id),
      distanceToCenter: dist,
      primaryCluster: c,
      closestOtherCluster: row.closest_cluster_by_dist,
      _angle: row._angle ?? 0,
      _radius_frac: row._radius_frac ?? 0.5,
    };
  });
}

/**
 * Dandelion-style rings: sort by distance to center, split into a few layers,
 * equal spacing on angle within each ring, staggered phase between rings.
 */
function enrichItemsWithLayerCoords(items, maxRadiusPx) {
  const n = items.length;
  if (n === 0) return [];

  const layerCount = Math.min(
    5,
    Math.max(2, Math.ceil(Math.sqrt(n))),
  );
  const indexed = items.map((item, idx) => ({ item, idx }));
  indexed.sort((a, b) => {
    const d = a.item.distanceToCenter - b.item.distanceToCenter;
    if (d !== 0) return d;
    return a.idx - b.idx;
  });

  const perLayer = Math.ceil(n / layerCount);
  const layers = [];
  for (let L = 0; L < layerCount; L++) {
    const slice = indexed.slice(L * perLayer, (L + 1) * perLayer);
    if (slice.length) layers.push(slice.map((x) => x.item));
  }

  const rMin = maxRadiusPx * 0.16;
  const rMax = maxRadiusPx;
  const Ln = layers.length;
  const out = [];

  layers.forEach((layerItems, L) => {
    const m = layerItems.length;
    const frac = Ln <= 1 ? 1 : L / (Ln - 1);
    const r = rMin + frac * (rMax - rMin);
    const phase = L * (Math.PI / Math.max(m, 6));
    layerItems.forEach((item, j) => {
      const angle = (j / Math.max(m, 1)) * 2 * Math.PI + phase;
      out.push({ ...item, _angle: angle, _radius: r });
    });
  });

  return out;
}

const layoutGroups = computed(() => {
  if (viewMode.value === "exhibitions") {
  const rows = props.exhibitions ?? [];
  const k = rows.length;
  const out = {};
  if (!k) return out;

  const aw = Math.max(svgSize.value.width - CANVAS_PADDING * 2 || PACK_FALLBACK_W, 400);
  const ah = Math.max(svgSize.value.height - CANVAS_PADDING * 2 || PACK_FALLBACK_H, 400);

  rows.forEach((ex, idx) => {
    const { nx, ny } = exhibitionGridNormCell(k, idx, aw, ah);

    out[idx] = {
      clusterId: idx,
      name: ex.name,
      refNormX: nx,
      refNormY: ny,
      normX: nx,
      normY: ny,
      centerLabels: ex.labels ?? [],
      // add artistName from lookup
      items: ex.items.map((item) => ({
        ...item,
        artistName: artistDisplayName(item.artistId),
        distanceToCenter: item._radius_frac,   // keeps maxDistInView logic working
        primaryCluster: idx,
        closestOtherCluster: null,
      })),
    };
  });
  return out;
}

  const n = selectedN.value;
  const data = currentJsonRows.value;
  const pos = currentClusterPositions.value;
  const out = {};

  for (let c = 0; c < n; c++) {
    const p = pos[String(c)];
    const rawX = p?.x ?? 0.5;
    const rawY = p?.y ?? 0.5;
    const nx = clampRefNorm01(rawX);
    const ny = clampRefNorm01(rawY);
    const rowsHere = data.filter((r) => r.primary_cluster === c);
    const centerLabels = centerLabelsForJsonCluster(c, rowsHere);

    out[c] = {
      clusterId: c,
      name: `Cluster ${c}`,
      refNormX: nx,
      refNormY: ny,
      normX: nx,
      normY: ny,
      centerLabels,
      items: [],
    };
  }

  const isInstitution = viewMode.value === "institution";
  for (const row of data) {
    const c = row.primary_cluster;
    if (!out[c]) continue;
    const pieces = jsonRowToDisplayItems(row, isInstitution);
    for (const piece of pieces) {
      out[c].items.push(piece);
    }
  }

  return out;
});

const layoutGroupsList = computed(() =>
  Object.values(layoutGroups.value).sort(
    (a, b) => a.clusterId - b.clusterId,
  ),
);

const placedLayoutGroups = computed(() =>
  layoutGroupsList.value.filter((g) => g.items?.length > 0)
);

const canvasLayoutStyle = computed(() => {
  if (viewMode.value === "exhibitions") return { minHeight: "600px" };
  const entry = activePositions.value?.find((p) => p.n === selectedN.value);
  if (!entry) return { minHeight: "600px" };
  const w = containerWidth.value || entry.canvas_min_w;
  const h = Math.round(w / (entry.aspect_ratio ?? 1.5));
  return {
    width: "100%",
    height: `${Math.max(h, 500)}px`,
  };
});

const maxDistInView = computed(() => {
  let m = 0.001;
  for (const g of placedLayoutGroups.value) {
    for (const a of g.items) {
      if (a.distanceToCenter > m) m = a.distanceToCenter;
    }
  }
  return m;
});

function getClusterCanvasPos(group) {
  if (
    !group ||
    typeof group.normX !== "number" ||
    typeof group.normY !== "number"
  ) {
    return { x: CANVAS_PADDING, y: CANVAS_PADDING };
  }
  return normToCanvas(group.normX, group.normY);
}

/** Anchor point (cluster center in px); dot is translate(-50%,-50%) so its center sits here. */
function getClusterAnchorStyle(group) {
  const { x, y } = getClusterCanvasPos(group);
  return {
    left: `${x}px`,
    top: `${y}px`,
  };
}

function getArtistStyle(artist, group) {
  const { x: cx, y: cy } = getClusterCanvasPos(group);
  const r = (artist._radius_frac ?? 0.5) * CLUSTER_RADIUS;
  const angle = artist._angle ?? 0;
  return {
    left: `${cx + Math.cos(angle) * r - POINT_SIZE / 2}px`,
    top: `${cy + Math.sin(angle) * r - POINT_SIZE / 2}px`,
  };
}

function pointKey(group, item, index) {
  return `${group.clusterId}-${index}-${item.artistId}`;
}

const hoveredPoint = ref(null);
const clusterCenterPositions = ref({});
const pointPositions = ref({});

const allLines = computed(() => {
  const centers = clusterCenterPositions.value;
  const pts = pointPositions.value;
  const lines = [];
  if (!Object.keys(centers).length || !Object.keys(pts).length) return lines;

  for (const group of placedLayoutGroups.value) {
    const cid = group.clusterId;
    const cx = centers[cid];
    if (!cx) continue;

    group.items.forEach((item, idx) => {
      const pk = pointKey(group, item, idx);
      const pt = pts[pk];
      if (!pt) return;

      lines.push({
        key: `${pk}-own`,
        pointKey: pk,
        x1: pt.x,
        y1: pt.y,
        x2: cx.x,
        y2: cx.y,
      });

      const otherId = item.closestOtherCluster;
      const sameAsPrimary =
        otherId != null && Number(otherId) === Number(item.primaryCluster);
      if (otherId != null && !sameAsPrimary && centers[otherId]) {
        const oc = centers[otherId];
        lines.push({
          key: `${pk}-other`,
          pointKey: pk,
          x1: pt.x, y1: pt.y,
          x2: oc.x, y2: oc.y,
          isOther: true,
        });
      }
    });
  }
  return lines;
});

function recalcPositions() {
  if (!sectionRef.value) return;
  const sectionRect = sectionRef.value.getBoundingClientRect();
  const w = sectionRect.width;
  const h = sectionRect.height;
  containerWidth.value = w;          // ← add this
  if (svgSize.value.width !== w || svgSize.value.height !== h) {
    svgSize.value = { width: w, height: h };
  }

  const newCenters = {};
  for (const el of sectionRef.value.querySelectorAll("[data-cluster-center]")) {
    const cid = +el.dataset.clusterCenter;
    const r = el.getBoundingClientRect();
    newCenters[cid] = {
      x: r.left + r.width / 2 - sectionRect.left,
      y: r.top + r.height / 2 - sectionRect.top,
    };
  }
  clusterCenterPositions.value = newCenters;

  const newPts = {};
  for (const el of sectionRef.value.querySelectorAll("[data-point-id]")) {
    const key = el.dataset.pointId;
    const r = el.getBoundingClientRect();
    newPts[key] = {
      x: r.left + r.width / 2 - sectionRect.left,
      y: r.top + r.height / 2 - sectionRect.top,
    };
  }
  pointPositions.value = newPts;
}

watch(
  [
    selectedN,
    viewMode,
    layoutGroupsList,
    () => [svgSize.value.width, svgSize.value.height]
  ],
  () => {
    nextTick(() => {
      recalcPositions();
      requestAnimationFrame(() => recalcPositions());
    });
  },
);

let resizeObserver = null;

onMounted(() => {
  nextTick(() => {
    applyInitialNIfNeeded();
    recalcPositions();
  });
  if (sectionRef.value) {
    resizeObserver = new ResizeObserver(recalcPositions);
    resizeObserver.observe(sectionRef.value);
  }
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
});

function handlePointClick(item) {
  const id = item.artistId;
  emit("select-point", {
    name: item.artistName,
    items: [{ artist: id == null ? id : String(id) }],
  });
}

function handleCenterClick(group) {
  const seen = new Set();
  const uniqueArtists = [];
  for (const item of group.items) {
    if (seen.has(item.artistId)) continue;
    seen.add(item.artistId);
    uniqueArtists.push({
      artist: item.artistId,
      artistName: item.artistName,
    });
  }
  emit("select-cluster", {
    name: group.name,
    items: uniqueArtists.map((a) => ({
      artist: a.artist == null ? a.artist : String(a.artist),
      artistName: a.artistName,
    })),
  });
}

function displayLabelLine(i, group) {
  const raw = (group.centerLabels ?? [])[i];
  if (raw == null || raw === "") return "";
  return String(raw).toUpperCase();
}
</script>

<template>
  <div class="cluster-section-root">
    <div class="cs-controls">
      <div class="cs-mode-toggle">
        <button
          type="button"
          :class="['cs-mode-btn', { 'cs-mode-btn--active': viewMode === 'exhibitions' }]"
          @click="viewMode = 'exhibitions'"
        >
          Exhibitions
        </button>
        <button
          type="button"
          :class="['cs-mode-btn', { 'cs-mode-btn--active': viewMode === 'artist' }]"
          @click="viewMode = 'artist'"
        >
          Artists
        </button>
        <button
          type="button"
          :class="['cs-mode-btn', { 'cs-mode-btn--active': viewMode === 'institution' }]"
          @click="viewMode = 'institution'"
        >
          Institutions
        </button>
      </div>

      <div
        class="cs-slider-block"
        :class="{ 'cs-slider-block--disabled': sliderDisabled }"
      >
        <span class="cs-slider-label">n = {{ sliderDisabled ? '—' : selectedN }}</span>
        <input
          type="range"
          class="cs-slider"
          :disabled="sliderDisabled"
          :min="0"
          :max="Math.max(0, availableN.length - 1)"
          :step="1"
          v-model.number="selectedNIndex"
        />
        <div v-if="!sliderDisabled" class="cs-slider-ticks">
          <span v-for="n in availableN" :key="n" class="cs-tick">{{ n }}</span>
        </div>
      </div>
    </div>

    <div
      ref="sectionRef"
      class="cluster-section-canvas"
      :style="canvasLayoutStyle"
    >
      <svg
        class="cluster-section-svg"
        :width="svgSize.width"
        :height="svgSize.height"
      >
        <line
          v-for="line in allLines"
          :key="line.key"
          :x1="line.x1" :y1="line.y1"
          :x2="line.x2" :y2="line.y2"
          :class="[
            'cluster-line',
            { 'cluster-line--active': hoveredPoint === line.pointKey },
            { 'cluster-line--other': line.isOther },
          ]"
        />
      </svg>

      <div
        v-for="group in placedLayoutGroups"
        :key="group.clusterId"
        class="cs-cluster-group"
      >
        <div
          class="cs-center-anchor"
          :style="getClusterAnchorStyle(group)"
        >
          <div
            class="cs-center-dot"
            :data-cluster-center="group.clusterId"
            aria-hidden="true"
            @click.stop="handleCenterClick(group)"
          />
          <div class="cs-center-labels">
            <span v-if="displayLabelLine(0, group)" class="cs-center-label-line">{{
              displayLabelLine(0, group)
            }}</span>
            <span v-if="displayLabelLine(1, group)" class="cs-center-label-line">{{
              displayLabelLine(1, group)
            }}</span>
            <span
              v-if="!displayLabelLine(0, group) && !displayLabelLine(1, group)"
              class="cs-center-label-line cs-center-label-line--empty"
            >—</span>
          </div>
        </div>

        <div
          v-for="(item, idx) in group.items"
          :key="pointKey(group, item, idx)"
          class="cs-point"
          :class="{ 'cs-point--hovered': hoveredPoint === pointKey(group, item, idx) }"
          :style="getArtistStyle(item, group)"
          :data-point-id="pointKey(group, item, idx)"
          :title="item.artistName"
          @mouseenter="hoveredPoint = pointKey(group, item, idx)"
          @mouseleave="hoveredPoint = null"
          @click.stop="handlePointClick(item)"
        >
          <div class="cs-tooltip">{{ item.artistName }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped src="./style.css"></style>
