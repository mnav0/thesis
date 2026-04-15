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

const POINT_SIZE = 14;
const CLUSTER_RADIUS = 118;
const CANVAS_PADDING = 50;
const CLUSTER_BOX_MIN_WIDTH = 150;
const CLUSTER_BOX_MIN_HEIGHT = 170;
const CLUSTER_BOX_PADDING = 18;
const CLUSTER_LABEL_GAP = 10;
/** for non-exhibition layouts to avoid overflow */
const CLUSTER_SAFE_AREA_SCALE = 0.75;
/** Norm-space inset for the exhibition grid (room for labels before spread). */
const EXHIBITION_GRID_EDGE = 0.07;
const EXHIBITION_CLUSTER_SPREAD = 1.4;
const PACK_FALLBACK_W = 960;
const PACK_FALLBACK_H = 720;

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

const currentClusterPositions = computed(
  () =>
    activePositions.value?.find((p) => p.n === selectedN.value)
      ?.cluster_positions ?? {},
);

function canvasPaddingPx() {
  return CANVAS_PADDING;
}

function clamp01(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Keep cluster centers in a visible normalized window based on real pixel geometry.
 * This prevents off-screen clusters for artist/institution layouts on narrower viewports.
 */
function visibleNormBounds() {
  const pad = canvasPaddingPx();
  const w = Math.max(1, svgSize.value.width);
  const h = Math.max(1, svgSize.value.height);
  const innerW = Math.max(1, w - pad * 2);
  const innerH = Math.max(1, h - pad * 2);
  const keepPx = CLUSTER_RADIUS + POINT_SIZE;
  const minXBase = clamp01(keepPx / innerW, 0.02, 0.45);
  const minYBase = clamp01(keepPx / innerH, 0.02, 0.45);
  if (viewMode.value === "exhibitions") {
    return {
      minX: minXBase,
      maxX: 1 - minXBase,
      minY: minYBase,
      maxY: 1 - minYBase,
    };
  }

  const sx = clamp01(CLUSTER_SAFE_AREA_SCALE, 0.35, 1);
  const sy = clamp01(CLUSTER_SAFE_AREA_SCALE, 0.35, 1);
  const targetMinX = (1 - sx) / 2;
  const targetMinY = (1 - sy) / 2;
  const minX = Math.max(minXBase, targetMinX);
  const minY = Math.max(minYBase, targetMinY);
  return {
    minX,
    maxX: 1 - minX,
    minY,
    maxY: 1 - minY,
  };
}

function normToCanvas(x, y) {
  const pad = canvasPaddingPx();
  const { width, height } = svgSize.value;
  return {
    x: pad + x * (width - pad * 2),
    y: pad + y * (height - pad * 2),
  };
}

function clampRefNormXY(x, y) {
  const b = visibleNormBounds();
  return {
    nx: clamp01(Number(x) || 0.5, b.minX, b.maxX),
    ny: clamp01(Number(y) || 0.5, b.minY, b.maxY),
  };
}

function fitNormPointsWithinBounds(points) {
  if (!points.length) return new Map();
  const b = visibleNormBounds();
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const spanX = Math.max(maxX - minX, 1e-6);
  const spanY = Math.max(maxY - minY, 1e-6);
  const out = new Map();
  for (const p of points) {
    const tx = (p.x - minX) / spanX;
    const ty = (p.y - minY) / spanY;
    out.set(p.id, {
      nx: b.minX + tx * (b.maxX - b.minX),
      ny: b.minY + ty * (b.maxY - b.minY),
    });
  }
  return out;
}

/** Even grid inside [edge, 1-edge]²; aspect drives row/column count like pack. */
function exhibitionGridNormCell(k, index, aspectW, aspectH) {
  const edge = EXHIBITION_GRID_EDGE;
  const usable = Math.max(0.2, 1 - 2 * edge);
  const a = Math.max(0.5, aspectW / Math.max(aspectH, 1));
  const cols = Math.max(1, Math.ceil(Math.sqrt(k * a)));
  const rows = Math.ceil(k / cols);
  const col = index % cols;
  const row = Math.floor(index / cols);
  return {
    nx: edge + usable * ((col + 0.5) / cols),
    ny: edge + usable * ((row + 0.5) / rows),
    rows,
    cols,
  };
}

/** Radially separate exhibition cluster centers so they breathe on the canvas. */
function spreadExhibitionNorm(nx, ny) {
  const s = EXHIBITION_CLUSTER_SPREAD;
  const x = 0.5 + (nx - 0.5) * s;
  const y = 0.5 + (ny - 0.5) * s;
  const c = clampRefNormXY(x, y);
  return { normX: c.nx, normY: c.ny };
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
  return {
    artistId: row.artist,
    artistName: artistDisplayName(row.artist),
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
  return names.map((name) => {
    const id = artistIdForDisplayName(name) ?? row.artist;
    return {
      artistId: id,
      artistName: artistDisplayName(id),
      primaryCluster: c,
      closestOtherCluster: row.closest_cluster_by_dist,
      _angle: row._angle ?? 0,
      _radius_frac: row._radius_frac ?? 0.5,
    };
  });
}

const layoutGroups = computed(() => {
  if (viewMode.value === "exhibitions") {
  const rows = props.exhibitions ?? [];
  const k = rows.length;
  const out = {};
  if (!k) return out;

  const pad = CANVAS_PADDING;
  const aw = Math.max(svgSize.value.width - pad * 2 || PACK_FALLBACK_W, 400);
  const ah = Math.max(svgSize.value.height - pad * 2 || PACK_FALLBACK_H, 400);

  rows.forEach((ex, idx) => {
    const { nx, ny } = exhibitionGridNormCell(k, idx, aw, ah);
    const { normX, normY } = spreadExhibitionNorm(nx, ny);

    out[idx] = {
      clusterId: idx,
      name: ex.name,
      normX,
      normY,
      centerLabels: ex.labels ?? [],
      // add artistName from lookup
      items: ex.items.map((item) => ({
        ...item,
        artistName: artistDisplayName(item.artistId),
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
  const rawCenters = [];

  for (let c = 0; c < n; c++) {
    const p = pos[String(c)];
    const rawX = p?.x ?? 0.5;
    const rawY = p?.y ?? 0.5;
    rawCenters.push({ id: c, x: rawX, y: rawY });
    const rowsHere = data.filter((r) => r.primary_cluster === c);
    const centerLabels = centerLabelsForJsonCluster(c, rowsHere);

    out[c] = {
      clusterId: c,
      name: `Cluster ${c}`,
      normX: rawX,
      normY: rawY,
      centerLabels,
      items: [],
    };
  }

  const fitted = fitNormPointsWithinBounds(rawCenters);
  for (const c of Object.keys(out)) {
    const id = Number(c);
    const p = fitted.get(id);
    if (!p) continue;
    out[id].normX = p.nx;
    out[id].normY = p.ny;
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

function getClusterCanvasPos(group) {
  const pad = canvasPaddingPx();
  if (
    !group ||
    typeof group.normX !== "number" ||
    typeof group.normY !== "number"
  ) {
    return { x: pad, y: pad };
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
const hoveredClusterId = ref(null);
const clusterCenterPositions = ref({});
const pointPositions = ref({});

const pointDetailsByKey = computed(() => {
  const out = {};
  for (const group of placedLayoutGroups.value) {
    group.items.forEach((item, idx) => {
      const pk = pointKey(group, item, idx);
      out[pk] = {
        clusterId: group.clusterId,
      };
    });
  }
  return out;
});

const activeClusterId = computed(() => {
  if (hoveredPoint.value && pointDetailsByKey.value[hoveredPoint.value]) {
    return pointDetailsByKey.value[hoveredPoint.value].clusterId;
  }
  return hoveredClusterId.value;
});

const allLines = computed(() => {
  const centers = clusterCenterPositions.value;
  const pts = pointPositions.value;
  const lines = [];
  if (!Object.keys(centers).length || !Object.keys(pts).length) return lines;

  /** Exhibition mode: same artistId may appear in multiple shows — link dot-to-dot on hover. */
  let peersByArtist = null;
  if (viewMode.value === "exhibitions") {
    peersByArtist = new Map();
    for (const g of placedLayoutGroups.value) {
      g.items.forEach((item, idx) => {
        const pk = pointKey(g, item, idx);
        const k = item.artistId == null ? NaN : Number(item.artistId);
        if (Number.isNaN(k)) return;
        if (!peersByArtist.has(k)) peersByArtist.set(k, []);
        peersByArtist.get(k).push({ clusterId: g.clusterId, pointKey: pk });
      });
    }
  }

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
        sourceClusterId: cid,
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
          sourceClusterId: cid,
          x1: pt.x, y1: pt.y,
          x2: oc.x, y2: oc.y,
          isOther: true,
        });
      }

      if (peersByArtist) {
        const k = item.artistId == null ? NaN : Number(item.artistId);
        if (Number.isNaN(k)) return;
        for (const peer of peersByArtist.get(k) ?? []) {
          if (peer.clusterId === group.clusterId) continue;
          const opt = pts[peer.pointKey];
          if (!opt) continue;
          lines.push({
            key: `${pk}-expeer-${peer.pointKey}`,
            sourceClusterId: cid,
            targetPointKey: peer.pointKey,
            x1: pt.x,
            y1: pt.y,
            x2: opt.x,
            y2: opt.y,
            isOther: true,
          });
        }
      }
    });
  }
  return lines;
});

const activeLineKeys = computed(() => {
  const cid = activeClusterId.value;
  if (cid == null) return new Set();
  return new Set(
    allLines.value
      .filter((line) => line.sourceClusterId === cid)
      .map((line) => line.key),
  );
});

const activePointKeys = computed(() => {
  const cid = activeClusterId.value;
  if (cid == null) return new Set();
  const keys = new Set();

  for (const [pk, details] of Object.entries(pointDetailsByKey.value)) {
    if (details.clusterId === cid) keys.add(pk);
  }
  for (const line of allLines.value) {
    if (line.sourceClusterId !== cid) continue;
    if (line.targetPointKey) keys.add(line.targetPointKey);
  }
  return keys;
});

function isClusterActive(clusterId) {
  return activeClusterId.value != null && Number(activeClusterId.value) === Number(clusterId);
}

function initialsFromName(name) {
  const parts = String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getClusterBoxStyle(group) {
  const box = getClusterBoxMetrics(group);
  if (!box) return {};
  return {
    left: `${box.left}px`,
    top: `${box.top}px`,
    width: `${box.width}px`,
    height: `${box.height}px`,
  };
}

function getClusterLabelStyle(group) {
  const box = getClusterBoxMetrics(group);
  if (!box) return {};
  return {
    left: `${box.left + box.width / 2}px`,
    top: `${box.top + box.height + CLUSTER_LABEL_GAP}px`,
  };
}

function getClusterBoxMetrics(group) {
  if (!group) return null;
  let minX = -POINT_SIZE / 2;
  let maxX = POINT_SIZE / 2;
  let minY = -POINT_SIZE / 2;
  let maxY = POINT_SIZE / 2;

  for (const item of group.items ?? []) {
    const r = (item._radius_frac ?? 0.5) * CLUSTER_RADIUS;
    const angle = item._angle ?? 0;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    minX = Math.min(minX, x - POINT_SIZE / 2);
    maxX = Math.max(maxX, x + POINT_SIZE / 2);
    minY = Math.min(minY, y - POINT_SIZE / 2);
    maxY = Math.max(maxY, y + POINT_SIZE / 2);
  }

  const rawWidth = maxX - minX + CLUSTER_BOX_PADDING * 2;
  const rawHeight = maxY - minY + CLUSTER_BOX_PADDING * 2;
  const width = Math.max(CLUSTER_BOX_MIN_WIDTH, rawWidth);
  const height = Math.max(CLUSTER_BOX_MIN_HEIGHT, rawHeight);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  return {
    width,
    height,
    left: cx - width / 2,
    top: cy - height / 2,
  };
}

function recalcPositions() {
  if (!sectionRef.value) return;
  const sectionRect = sectionRef.value.getBoundingClientRect();
  const w = sectionRect.width;
  const h = sectionRect.height;
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
  const labels = (group.centerLabels ?? [])
    .map((label) => String(label ?? "").trim())
    .filter(Boolean);
  const clusterTitle = labels.length ? labels.join(", ") : group.name;

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
    name: clusterTitle,
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
      @mouseleave="
        hoveredPoint = null;
        hoveredClusterId = null;
      "
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
            { 'cluster-line--active': activeLineKeys.has(line.key) },
            { 'cluster-line--other': line.isOther },
          ]"
        />
      </svg>

      <div
        v-for="group in placedLayoutGroups"
        :key="group.clusterId"
        class="cs-cluster-group"
        :class="{ 'cs-cluster-group--active': isClusterActive(group.clusterId) }"
      >
        <div
          class="cs-center-anchor"
          :style="getClusterAnchorStyle(group)"
        >
          <div
            class="cs-cluster-box-hit"
            :class="{ 'cs-cluster-box-hit--active': isClusterActive(group.clusterId) }"
            :style="getClusterBoxStyle(group)"
            @mouseenter="hoveredClusterId = group.clusterId"
            @mouseleave="hoveredClusterId = null"
            @click.stop="handleCenterClick(group)"
          />
          <div
            class="cs-center-dot"
            :data-cluster-center="group.clusterId"
            aria-hidden="true"
            @click.stop="handleCenterClick(group)"
          />
          <div
            v-if="isClusterActive(group.clusterId)"
            class="cs-center-labels"
            :style="getClusterLabelStyle(group)"
          >
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
          :class="{
            'cs-point--hovered': hoveredPoint === pointKey(group, item, idx),
            'cs-point--active-cluster': activePointKeys.has(pointKey(group, item, idx)),
          }"
          :style="getArtistStyle(item, group)"
          :data-point-id="pointKey(group, item, idx)"
          :data-artist-id="item.artistId == null ? null : String(item.artistId)"
          :title="item.artistName"
          @mouseenter="
            hoveredClusterId = group.clusterId;
            hoveredPoint = pointKey(group, item, idx);
          "
          @mouseleave="
            hoveredPoint = null;
          "
          @click.stop="handlePointClick(item)"
        >
          <div
            v-if="activePointKeys.has(pointKey(group, item, idx))"
            class="cs-point-tag"
          >
            {{ initialsFromName(item.artistName) }}
          </div>
          <div class="cs-tooltip">{{ item.artistName }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped src="./style.css"></style>
