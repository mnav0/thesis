<script setup>
import {
  ref,
  computed,
  onMounted,
  onBeforeUnmount,
  nextTick,
  watch,
} from "vue";
import { artistsById, exhibitionEntryCount, exhibitionsById } from "../../data/index.js";
import { DOT_SIZE_PX } from "../../constants.js";
import ArtistDot from "../ArtistDot/index.vue";

const props = defineProps({
  exhibitions: {
    type: Object,
    default: () => ({ exhibitions: [], artists: [] }),
  },
  artistData: {
    type: Object,
    default: () => ({ numClusters: [] }),
  },
  institutionData: {
    type: Object,
    default: () => ({ numClusters: [] }),
  },
  /** @type {'exhibitions' | 'artist' | 'institution'} */
  initialViewMode: {
    type: String,
    default: "exhibitions",
  },
  initialN: { type: Number, default: null },
});

const emit = defineEmits(["select-point", "select-cluster"]);

// --- layout constants ---
const POINT_SIZE = DOT_SIZE_PX;
const CLUSTER_RADIUS = 118;
const CANVAS_PADDING = 50;
const CLUSTER_BOX_MIN_WIDTH = 150;
const CLUSTER_BOX_MIN_HEIGHT = 170;
const CLUSTER_BOX_PADDING = 18;
const CLUSTER_LABEL_GAP = 10;
const CLUSTER_KEYWORDS_TO_SHOW = 2;
const CLUSTER_SAFE_AREA_SCALE = 0.75;
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

// --- mode + summary selection ---
const sectionRef = ref(null);
const svgSize = ref({ width: 0, height: 0 });

const activeSummary = computed(() =>
  viewMode.value === "institution" ? props.institutionData : props.artistData,
);

const numClustersList = computed(() => {
  const src = activeSummary.value?.numClusters;
  return Array.isArray(src) ? src : [];
});

const availableN = computed(() => {
  if (viewMode.value === "exhibitions") return [];
  const list = numClustersList.value;
  if (!list.length) return [];
  return [...new Set(list.map((d) => d.n))].sort((a, b) => a - b);
});

const selectedN = computed(() => availableN.value[selectedNIndex.value] ?? 0);

const sliderDisabled = computed(() => viewMode.value === "exhibitions");

const normalizedExhibitionData = computed(() => {
  const src = props.exhibitions;
  const exRows = Array.isArray(src?.exhibitions) ? src.exhibitions : [];
  const artists = Array.isArray(src?.artists) ? src.artists : [];
  return { exhibitions: exRows, artists };
});

const artistsByExhibitionId = computed(() => {
  const map = new Map();
  for (const artist of normalizedExhibitionData.value.artists ?? []) {
    for (const exhibitionId of artist.exhibitionIds ?? []) {
      const id = Number(exhibitionId);
      if (!Number.isFinite(id)) continue;
      if (!map.has(id)) map.set(id, []);
      map.get(id).push(artist);
    }
  }
  return map;
});

const sharedArtistItems = computed(() => {
  if (viewMode.value !== "exhibitions") return [];
  const artists = normalizedExhibitionData.value.artists ?? [];
  return artists
    .filter((a) => a.isShared)
    .map((a) => ({
      artistId: a.artistId,
      artistName: artistDisplayName(a.artistId),
      exhibitionIds: a.exhibitionIds,
      isShared: true,
      _jitter_angle: a._jitter_angle ?? 0,
      _radius_frac: a._radius_frac ?? 0.85,
      primaryCluster: a.exhibitionIds[0],
      closestOtherCluster: a.exhibitionIds[1] ?? null,
    }));
});

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

const currentClusterEntry = computed(() => {
  const n = selectedN.value;
  return numClustersList.value.find((e) => e.n === n) ?? null;
});

const lastClusterN = ref(null);

watch(selectedN, (n) => {
  if (viewMode.value !== "exhibitions") lastClusterN.value = n;
});

watch(viewMode, () => {
  nextTick(() => {
    if (viewMode.value === "exhibitions") return;
    const vals = availableN.value;
    if (!vals.length) return;
    const want = lastClusterN.value;
    if (want != null && vals.includes(want)) {
      selectedNIndex.value = vals.indexOf(want);
      return;
    }
    if (want != null) {
      const lower = [...vals].filter((v) => v <= want).pop();
      const pick = lower ?? vals[0];
      selectedNIndex.value = vals.indexOf(pick);
      return;
    }
    selectedNIndex.value = Math.min(
      selectedNIndex.value,
      Math.max(0, vals.length - 1),
    );
  });
});

function canvasPaddingPx() {
  return CANVAS_PADDING;
}

function clamp01(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

// Keeps norm coords on-screen; artist/institution uses a tighter safe rect.
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

function spreadExhibitionNorm(nx, ny) {
  const s = EXHIBITION_CLUSTER_SPREAD;
  const x = 0.5 + (nx - 0.5) * s;
  const y = 0.5 + (ny - 0.5) * s;
  const c = clampRefNormXY(x, y);
  return { normX: c.nx, normY: c.ny };
}

const SHARED_JITTER_PX = 24;
const POINT_JITTER_PX = 10;
const POINT_COLLISION_MIN_DIST = POINT_SIZE * 0.95;
// Cap so dense layouts don’t shove dots into weird pockets.
const POINT_COLLISION_MAX_NUDGE = 18;

// Shared midpoint: runner-up pulls the blend only within this mass gap of primary.
const SHARED_BLEND_GAP = 0.15;
// Line thickness / “primary” activation: same numeric idea, separate tuning knob.
const PRIMARY_LINE_GAP = 0.15;

function sharedLinkIds(artist) {
  if (viewMode.value === "exhibitions") {
    return (artist.exhibitionIds ?? []).map((id) => Number(id)).filter(Number.isFinite);
  }
  return (artist.clusterIds ?? []).map((id) => Number(id)).filter(Number.isFinite);
}

function sharedJitterAngle(artist) {
  if (viewMode.value === "exhibitions") {
    return artist._jitter_angle ?? 0;
  }
  return artist._jitter_angle ?? artist._angle ?? 0;
}

function distributionMass(clusterDistribution, clusterId) {
  if (!clusterDistribution || typeof clusterDistribution !== "object") return 0;
  const raw = clusterDistribution[String(clusterId)] ?? clusterDistribution[clusterId];
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function stableJitterAngle(seedA, seedB = 0) {
  const x = Number(seedA) * 12.9898 + Number(seedB) * 78.233;
  const n = Math.sin(x) * 43758.5453;
  const frac = n - Math.floor(n);
  return frac * Math.PI * 2;
}

function isPrimarySpoke(clusterDistribution, primaryIdRaw, targetClusterIdRaw) {
  const clusterId = Number(targetClusterIdRaw);
  const primaryId = Number(primaryIdRaw);
  if (!Number.isFinite(clusterId) || !Number.isFinite(primaryId)) return false;
  if (!clusterDistribution || typeof clusterDistribution !== "object") {
    return clusterId === primaryId;
  }
  const wPrimary = distributionMass(clusterDistribution, primaryId);
  const w = distributionMass(clusterDistribution, clusterId);
  return w > 0 && w >= wPrimary - PRIMARY_LINE_GAP;
}

/** Same threshold as line `isOther` / active cluster boxes for summary dots. */
function primaryLikePoint(details, clusterIdRaw) {
  if (!details) return false;
  return isPrimarySpoke(
    details.clusterDistribution,
    details.primaryCluster ?? details.clusterId,
    clusterIdRaw,
  );
}

function secondStrongestClusterId(clusterDistribution, primaryId) {
  const p = Number(primaryId);
  let bestId = null;
  let bestW = -1;
  for (const [key, wRaw] of Object.entries(clusterDistribution)) {
    const id = Number(key);
    const w = Number(wRaw);
    if (!Number.isFinite(id) || !Number.isFinite(w) || w <= 0) continue;
    if (id === p) continue;
    if (w > bestW) {
      bestW = w;
      bestId = id;
    }
  }
  return bestId == null ? null : { id: bestId, mass: bestW };
}

function getSharedArtistCanvasPos(artist) {
  const ja = sharedJitterAngle(artist);

  if (viewMode.value === "exhibitions") {
    const positions = sharedLinkIds(artist)
      .map((id) => {
        const g = layoutGroupsList.value.find((gr) => gr.clusterId === id);
        return g ? getClusterCanvasPos(g) : null;
      })
      .filter(Boolean);
    if (!positions.length) return null;
    const avgX = positions.reduce((s, p) => s + p.x, 0) / positions.length;
    const avgY = positions.reduce((s, p) => s + p.y, 0) / positions.length;
    return {
      x: avgX + Math.cos(ja) * SHARED_JITTER_PX,
      y: avgY + Math.sin(ja) * SHARED_JITTER_PX,
    };
  }

  const primaryId = Number(artist.primaryCluster);
  const dist = artist.clusterDistribution;
  if (!Number.isFinite(primaryId) || !dist) return null;

  const gPrimary = layoutGroupsList.value.find((gr) => gr.clusterId === primaryId);
  const pPrimary = gPrimary ? getClusterCanvasPos(gPrimary) : null;
  if (!pPrimary) return null;

  const wPrimary = distributionMass(dist, primaryId);
  const runnerUp = secondStrongestClusterId(dist, primaryId);
  let x = pPrimary.x;
  let y = pPrimary.y;

  if (
    runnerUp &&
    runnerUp.mass > 0 &&
    runnerUp.mass >= wPrimary - SHARED_BLEND_GAP
  ) {
    const gSec = layoutGroupsList.value.find((gr) => gr.clusterId === runnerUp.id);
    const pSec = gSec ? getClusterCanvasPos(gSec) : null;
    if (pSec) {
      const sum = wPrimary + runnerUp.mass;
      const t = sum > 0 ? wPrimary / sum : 1;
      const u = sum > 0 ? runnerUp.mass / sum : 0;
      x = t * pPrimary.x + u * pSec.x;
      y = t * pPrimary.y + u * pSec.y;
    }
  }

  const angle = artist._angle ?? 0;
  const ringR = (artist._radius_frac ?? 0.5) * CLUSTER_RADIUS;
  x += Math.cos(angle) * ringR;
  y += Math.sin(angle) * ringR;

  x += Math.cos(ja) * SHARED_JITTER_PX;
  y += Math.sin(ja) * SHARED_JITTER_PX;

  return { x, y };
}

function getSharedArtistStyle(artist) {
  const key = `shared-${artist.artistId}`;
  const pos = getSharedArtistCanvasPos(artist);
  if (!pos) return { display: "none" };
  const nudge = pointNudgesByKey.value[key] ?? { dx: 0, dy: 0 };
  return {
    left: `${pos.x + nudge.dx - POINT_SIZE / 2}px`,
    top: `${pos.y + nudge.dy - POINT_SIZE / 2}px`,
  };
}

function artistDisplayName(artistId) {
  const id = Number(artistId);
  if (Number.isNaN(id)) return `Artist ${artistId}`;
  return artistsById.value[id]?.name ?? `Artist ${id}`;
}

function clusterIdsFromDistribution(clusterDistribution) {
  if (!clusterDistribution || typeof clusterDistribution !== "object") return [];
  const ids = [];
  for (const [clusterId, weight] of Object.entries(clusterDistribution)) {
    const numericId = Number(clusterId);
    const numericWeight = Number(weight);
    if (!Number.isFinite(numericId) || !Number.isFinite(numericWeight)) continue;
    if (numericWeight > 0) ids.push(numericId);
  }
  return ids;
}

function summaryArtistToExclusiveItem(a) {
  return {
    artistId: a.artistId,
    artistName: artistDisplayName(a.artistId),
    primaryCluster: a.primaryGroup,
    closestOtherCluster: null,
    linkedClusterIds: clusterIdsFromDistribution(a.clusterDistribution),
    clusterDistribution: a.clusterDistribution,
    _angle: a._angle ?? 0,
    _radius_frac: a._radius_frac ?? 0.5,
    isShared: false,
  };
}

const clusterSharedArtistItems = computed(() => {
  if (viewMode.value !== "artist" && viewMode.value !== "institution") return [];
  const entry = currentClusterEntry.value;
  const artists = entry?.artists ?? [];
  return artists
    .filter((a) => a.isShared)
    .map((a) => ({
      artistId: a.artistId,
      artistName: artistDisplayName(a.artistId),
      exhibitionIds: [],
      clusterIds: clusterIdsFromDistribution(a.clusterDistribution),
      primaryCluster: a.primaryGroup,
      isShared: true,
      _jitter_angle: a._jitter_angle ?? a._angle ?? 0,
      _angle: a._angle,
      _radius_frac: a._radius_frac ?? 0.85,
      closestOtherCluster: null,
      linkedClusterIds: clusterIdsFromDistribution(a.clusterDistribution),
      clusterDistribution: a.clusterDistribution,
    }));
});

const surfaceSharedArtistItems = computed(() => {
  if (viewMode.value === "exhibitions") return sharedArtistItems.value;
  if (viewMode.value === "artist" || viewMode.value === "institution") {
    return clusterSharedArtistItems.value;
  }
  return [];
});

// --- layout: exhibition grid vs summary groups + exclusive ring items ---
const layoutGroups = computed(() => {
  if (viewMode.value === "exhibitions") {
    const exRows = normalizedExhibitionData.value.exhibitions ?? [];
    const artists = normalizedExhibitionData.value.artists ?? [];
    const k = exRows.length;
    const out = {};
    if (!k) return out;

    const aw = Math.max(svgSize.value.width - CANVAS_PADDING * 2 || PACK_FALLBACK_W, 400);
    const ah = Math.max(svgSize.value.height - CANVAS_PADDING * 2 || PACK_FALLBACK_H, 400);

    exRows.forEach((ex, idx) => {
      const { nx, ny } = exhibitionGridNormCell(k, idx, aw, ah);
      const { normX, normY } = spreadExhibitionNorm(nx, ny);
      const clusterId = Number(ex.id);

      // Shared artists render as midpoint nodes; per-cluster rings show exclusives only.
      const rawExclusive = (artistsByExhibitionId.value.get(clusterId) ?? [])
        .filter((a) => !a.isShared)
        .map((a) => ({
          artistId: a.artistId,
          artistName: artistDisplayName(a.artistId),
          _angle: a._angle,
          _radius_frac: a._radius_frac ?? 0.35,
          primaryCluster: clusterId,
          closestOtherCluster: null,
          isShared: false,
        }));
      const missingAngleCount = rawExclusive.filter((item) => item._angle == null).length;
      const exclusiveItems = missingAngleCount
        ? rawExclusive.map((item, itemIdx) => ({
            ...item,
            _angle:
              item._angle == null
                ? (itemIdx / Math.max(rawExclusive.length, 1)) * Math.PI * 2
                : item._angle,
          }))
        : rawExclusive;

      out[clusterId] = {
        clusterId,
        name: ex.name,
        normX,
        normY,
        centerLabels: ex.labels ?? [],
        items: exclusiveItems,
      };
    });
    return out;
  }

  const entry = currentClusterEntry.value;
  const out = {};
  if (!entry) return out;

  const groups = [...(entry.groups ?? [])].sort(
    (a, b) => Number(a.gridIndex) - Number(b.gridIndex),
  );
  const k = groups.length;
  if (!k) return out;

  const aw = Math.max(svgSize.value.width - CANVAS_PADDING * 2 || PACK_FALLBACK_W, 400);
  const ah = Math.max(svgSize.value.height - CANVAS_PADDING * 2 || PACK_FALLBACK_H, 400);

  groups.forEach((g, cellIdx) => {
    const clusterId = Number(g.id);
    const { nx, ny } = exhibitionGridNormCell(k, cellIdx, aw, ah);
    const { normX, normY } = spreadExhibitionNorm(nx, ny);
    const kw = Array.isArray(g.keywords) ? g.keywords : [];
    const centerLabels = kw.slice(0, CLUSTER_KEYWORDS_TO_SHOW).map(String);
    out[clusterId] = {
      clusterId,
      name: `Cluster ${clusterId}`,
      normX,
      normY,
      centerLabels,
      featuredQuote: g.featured_quote ?? null,
      items: [],
    };
  });

  for (const a of entry.artists ?? []) {
    if (a.isShared) continue;
    const c = Number(a.primaryGroup);
    if (!out[c]) continue;
    out[c].items.push(summaryArtistToExclusiveItem(a));
  }

  return out;
});

const layoutGroupsList = computed(() =>
  Object.values(layoutGroups.value).sort(
    (a, b) => a.clusterId - b.clusterId,
  ),
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

function getClusterAnchorStyle(group) {
  const { x, y } = getClusterCanvasPos(group);
  return {
    left: `${x}px`,
    top: `${y}px`,
  };
}

function getArtistStyle(artist, group, idx) {
  const { x: cx, y: cy } = getClusterCanvasPos(group);
  const r = (artist._radius_frac ?? 0.5) * CLUSTER_RADIUS;
  const angle = artist._angle ?? 0;
  const jitterAngle = stableJitterAngle(artist.artistId, artist.primaryCluster);
  const key = pointKey(group, artist, idx);
  const nudge = pointNudgesByKey.value[key] ?? { dx: 0, dy: 0 };
  return {
    left: `${cx + Math.cos(angle) * r + Math.cos(jitterAngle) * POINT_JITTER_PX + nudge.dx - POINT_SIZE / 2}px`,
    top: `${cy + Math.sin(angle) * r + Math.sin(jitterAngle) * POINT_JITTER_PX + nudge.dy - POINT_SIZE / 2}px`,
  };
}

function pointKey(group, item, index) {
  return `${group.clusterId}-${index}-${item.artistId}`;
}

function baseArtistCanvasPos(artist, group) {
  const { x: cx, y: cy } = getClusterCanvasPos(group);
  const r = (artist._radius_frac ?? 0.5) * CLUSTER_RADIUS;
  const angle = artist._angle ?? 0;
  const jitterAngle = stableJitterAngle(artist.artistId, artist.primaryCluster);
  return {
    x: cx + Math.cos(angle) * r + Math.cos(jitterAngle) * POINT_JITTER_PX,
    y: cy + Math.sin(angle) * r + Math.sin(jitterAngle) * POINT_JITTER_PX,
  };
}

// Collision pass: nudges are capped so stacks don’t explode outward.
const pointNudgesByKey = computed(() => {
  const points = [];
  for (const group of layoutGroupsList.value) {
    (group.items ?? []).forEach((item, idx) => {
      const base = baseArtistCanvasPos(item, group);
      points.push({
        key: pointKey(group, item, idx),
        x: base.x,
        y: base.y,
        seed: stableJitterAngle(item.artistId, group.clusterId + idx),
      });
    });
  }
  for (const artist of surfaceSharedArtistItems.value) {
    const base = getSharedArtistCanvasPos(artist);
    if (!base) continue;
    points.push({
      key: `shared-${artist.artistId}`,
      x: base.x,
      y: base.y,
      seed: stableJitterAngle(artist.artistId, 999),
    });
  }

  const out = {};
  const placed = [];
  for (const p of points) {
    let x = p.x;
    let y = p.y;
    for (const q of placed) {
      const dx = x - q.x;
      const dy = y - q.y;
      const d = Math.hypot(dx, dy);
      if (d >= POINT_COLLISION_MIN_DIST) continue;
      const overlap = POINT_COLLISION_MIN_DIST - d;
      const ang = d < 1e-6 ? p.seed : Math.atan2(dy, dx);
      x += Math.cos(ang) * overlap;
      y += Math.sin(ang) * overlap;
    }
    let ndx = x - p.x;
    let ndy = y - p.y;
    const nmag = Math.hypot(ndx, ndy);
    if (nmag > POINT_COLLISION_MAX_NUDGE && nmag > 0) {
      const t = POINT_COLLISION_MAX_NUDGE / nmag;
      ndx *= t;
      ndy *= t;
      x = p.x + ndx;
      y = p.y + ndy;
    }
    out[p.key] = { dx: ndx, dy: ndy };
    placed.push({ x, y });
  }
  return out;
});

const hoveredPoint = ref(null);
const hoveredClusterId = ref(null);
const clusterCenterPositions = ref({});
const pointPositions = ref({});
const renderEpoch = ref(0);

// --- hover geometry: point metadata + SVG lines (from measured DOM positions) ---
const pointDetailsByKey = computed(() => {
  const out = {};
  for (const group of layoutGroupsList.value) {
    group.items.forEach((item, idx) => {
      const pk = pointKey(group, item, idx);
      out[pk] = {
        clusterId: group.clusterId,
        primaryCluster: item.primaryCluster,
        artistId: item.artistId,
        clusterDistribution: item.clusterDistribution ?? null,
      };
    });
  }
  if (viewMode.value === "exhibitions") {
    for (const artist of sharedArtistItems.value) {
      out[`shared-${artist.artistId}`] = {
        clusterIds: (artist.exhibitionIds ?? []).map((id) => Number(id)),
        artistId: artist.artistId,
      };
    }
  } else if (viewMode.value === "artist" || viewMode.value === "institution") {
    for (const artist of clusterSharedArtistItems.value) {
      out[`shared-${artist.artistId}`] = {
        clusterIds: (artist.clusterIds ?? []).map((id) => Number(id)),
        artistId: artist.artistId,
        clusterId: artist.primaryCluster,
        primaryCluster: artist.primaryCluster,
        clusterDistribution: artist.clusterDistribution ?? null,
      };
    }
  }
  return out;
});

function artistIdFromPointKey(pointKey) {
  if (!pointKey) return null;
  const raw = pointDetailsByKey.value[pointKey]?.artistId;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

const hoveredPointDetails = computed(() =>
  hoveredPoint.value ? pointDetailsByKey.value[hoveredPoint.value] : null,
);

const activeClusterIds = computed(() => {
  const ids = new Set();
  const d = hoveredPointDetails.value;
  if (d) {
    if (Array.isArray(d.clusterIds)) {
      const primaryId = Number(d.primaryCluster ?? d.clusterId);
      const filterPrimary =
        viewMode.value === "artist" || viewMode.value === "institution";
      for (const id of d.clusterIds) {
        const n = Number(id);
        if (filterPrimary) {
          if (isPrimarySpoke(d.clusterDistribution, primaryId, n)) ids.add(n);
        } else {
          ids.add(n);
        }
      }
    } else if (d.clusterId != null) {
      ids.add(Number(d.clusterId));
      const aid = Number(d.artistId);
      if (viewMode.value === "exhibitions") {
        const shared = sharedArtistItems.value.find(
          (a) => Number(a.artistId) === aid,
        );
        for (const id of shared?.exhibitionIds ?? []) ids.add(Number(id));
      } else if (viewMode.value === "artist" || viewMode.value === "institution") {
        const shared = clusterSharedArtistItems.value.find(
          (a) => Number(a.artistId) === aid,
        );
        for (const id of shared?.clusterIds ?? []) ids.add(Number(id));
      }
    }
  }
  if (hoveredClusterId.value != null) ids.add(Number(hoveredClusterId.value));
  return ids;
});

const allLines = computed(() => {
  const centers = clusterCenterPositions.value;
  const pts = pointPositions.value;
  const lines = [];
  if (!Object.keys(centers).length || !Object.keys(pts).length) return lines;

  let peersByArtist = null;
  if (viewMode.value === "exhibitions") {
    peersByArtist = new Map();
    for (const g of layoutGroupsList.value) {
      g.items.forEach((item, idx) => {
        const pk = pointKey(g, item, idx);
        const k = item.artistId == null ? NaN : Number(item.artistId);
        if (Number.isNaN(k)) return;
        if (!peersByArtist.has(k)) peersByArtist.set(k, []);
        peersByArtist.get(k).push({ clusterId: g.clusterId, pointKey: pk });
      });
    }
  }

  for (const group of layoutGroupsList.value) {
    const cid = group.clusterId;
    const cx = centers[cid];
    if (!cx) continue;

    group.items.forEach((item, idx) => {
      const pk = pointKey(group, item, idx);
      const pt = pts[pk];
      if (!pt) return;

      lines.push({
        key: `${pk}-own`,
        kind: "center-point",
        sourcePointKey: pk,
        sourceClusterId: cid,
        targetClusterId: cid,
        x1: pt.x,
        y1: pt.y,
        x2: cx.x,
        y2: cx.y,
        isOther: !isPrimarySpoke(item.clusterDistribution, item.primaryCluster, cid),
      });

      const extraClusterIds = Array.isArray(item.linkedClusterIds)
        ? item.linkedClusterIds
        : item.closestOtherCluster != null
          ? [item.closestOtherCluster]
          : [];
      for (const otherIdRaw of extraClusterIds) {
        const otherId = Number(otherIdRaw);
        const sameAsPrimary = otherId === Number(item.primaryCluster);
        if (!Number.isFinite(otherId) || sameAsPrimary || !centers[otherId]) continue;
        const oc = centers[otherId];
        lines.push({
          key: `${pk}-other-${otherId}`,
          kind: "center-point",
          sourcePointKey: pk,
          sourceClusterId: cid,
          targetClusterId: otherId,
          x1: pt.x,
          y1: pt.y,
          x2: oc.x,
          y2: oc.y,
          isOther: !isPrimarySpoke(
            item.clusterDistribution,
            item.primaryCluster,
            otherId,
          ),
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
            kind: "point-point",
            sourcePointKey: pk,
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

  if (viewMode.value === "exhibitions") {
    for (const artist of sharedArtistItems.value) {
      const pk = `shared-${artist.artistId}`;
      const pt = pts[pk];
      if (!pt) continue;

      for (const eid of artist.exhibitionIds) {
        const cx = centers[eid];
        if (!cx) continue;
        lines.push({
          key: `${pk}-to-${eid}`,
          kind: "center-point",
          sourcePointKey: pk,
          sourceClusterId: eid,
          targetPointKey: pk,
          x1: pt.x,
          y1: pt.y,
          x2: cx.x,
          y2: cx.y,
          isOther: false,
        });
      }
    }
  }

  if (viewMode.value === "artist" || viewMode.value === "institution") {
    const primaryOf = (a) => Number(a.primaryCluster);
    for (const artist of clusterSharedArtistItems.value) {
      const pk = `shared-${artist.artistId}`;
      const pt = pts[pk];
      if (!pt) continue;
      const pId = primaryOf(artist);
      for (const cidRaw of artist.clusterIds ?? []) {
        const cid = Number(cidRaw);
        if (!Number.isFinite(cid)) continue;
        const cx = centers[cid];
        if (!cx) continue;
        lines.push({
          key: `${pk}-to-${cid}`,
          kind: "center-point",
          sourcePointKey: pk,
          sourceClusterId: pId,
          targetClusterId: cid,
          targetPointKey: pk,
          x1: pt.x,
          y1: pt.y,
          x2: cx.x,
          y2: cx.y,
          isOther: !isPrimarySpoke(
            artist.clusterDistribution,
            artist.primaryCluster,
            cid,
          ),
        });
      }
    }
  }

  return lines;
});

const directExhibitionLineKeys = computed(() => {
  const directKeys = new Set();
  if (viewMode.value !== "exhibitions") return directKeys;
  if (!hasActiveHoverContext.value) return directKeys;

  const centerPointLines = allLines.value.filter((line) => line.kind === "center-point");

  if (hoveredPoint.value) {
    const hoveredArtistId = artistIdFromPointKey(hoveredPoint.value);
    const artistPointKeys = new Set();

    if (hoveredArtistId != null) {
      for (const [pk, details] of Object.entries(pointDetailsByKey.value)) {
        const n = Number(details?.artistId);
        if (Number.isFinite(n) && n === hoveredArtistId) artistPointKeys.add(pk);
      }
    } else {
      artistPointKeys.add(hoveredPoint.value);
    }

    for (const line of centerPointLines) {
      const touchesArtist =
        artistPointKeys.has(line.sourcePointKey) ||
        artistPointKeys.has(line.targetPointKey);
      if (touchesArtist) directKeys.add(line.key);
    }
  } else if (hoveredClusterId.value != null) {
    const hoveredId = Number(hoveredClusterId.value);
    for (const line of centerPointLines) {
      if (Number(line.sourceClusterId) === hoveredId) directKeys.add(line.key);
    }
  }

  return directKeys;
});

const secondaryExhibitionLineKeys = computed(() => {
  const secondaryKeys = new Set();
  if (viewMode.value !== "exhibitions") return secondaryKeys;
  if (!hasActiveHoverContext.value) return secondaryKeys;

  const directKeys = directExhibitionLineKeys.value;
  const centerPointLines = allLines.value.filter((line) => line.kind === "center-point");

  if (hoveredPoint.value) {
    const associatedClusterIds = new Set();
    for (const line of centerPointLines) {
      if (!directKeys.has(line.key)) continue;
      const cid = Number(line.sourceClusterId);
      if (Number.isFinite(cid)) associatedClusterIds.add(cid);
      const tcid = Number(line.targetClusterId);
      if (Number.isFinite(tcid)) associatedClusterIds.add(tcid);
    }

    for (const line of centerPointLines) {
      if (directKeys.has(line.key)) continue;
      const cid = Number(line.sourceClusterId);
      if (associatedClusterIds.has(cid)) secondaryKeys.add(line.key);
    }
  } else if (hoveredClusterId.value != null) {
    const artistIds = new Set();
    for (const line of centerPointLines) {
      if (!directKeys.has(line.key)) continue;
      const sourceArtistId = artistIdFromPointKey(line.sourcePointKey);
      const targetArtistId = artistIdFromPointKey(line.targetPointKey);
      if (sourceArtistId != null) artistIds.add(sourceArtistId);
      if (targetArtistId != null) artistIds.add(targetArtistId);
    }

    for (const line of centerPointLines) {
      if (directKeys.has(line.key)) continue;
      const sourceArtistId = artistIdFromPointKey(line.sourcePointKey);
      const targetArtistId = artistIdFromPointKey(line.targetPointKey);
      if (artistIds.has(sourceArtistId) || artistIds.has(targetArtistId)) {
        secondaryKeys.add(line.key);
      }
    }
  }

  return secondaryKeys;
});

const directNonExhibitionLineKeys = computed(() => {
  const directKeys = new Set();
  if (viewMode.value === "exhibitions") return directKeys;
  if (!hasActiveHoverContext.value) return directKeys;

  const centerPointLines = allLines.value.filter((line) => line.kind === "center-point");

  if (hoveredPoint.value) {
    const d = pointDetailsByKey.value[hoveredPoint.value];
    for (const line of centerPointLines) {
      if (line.sourcePointKey !== hoveredPoint.value) continue;
      const targetClusterId = Number(line.targetClusterId);
      if (primaryLikePoint(d, targetClusterId)) {
        directKeys.add(line.key);
      }
    }
  } else if (hoveredClusterId.value != null) {
    const hoveredId = Number(hoveredClusterId.value);
    for (const line of centerPointLines) {
      const targetClusterId = Number(line.targetClusterId);
      if (targetClusterId !== hoveredId) continue;
      const details = pointDetailsByKey.value[line.sourcePointKey];
      if (primaryLikePoint(details, hoveredId)) {
        directKeys.add(line.key);
      }
    }
  }

  return directKeys;
});

const secondaryNonExhibitionLineKeys = computed(() => {
  const secondaryKeys = new Set();
  if (viewMode.value === "exhibitions") return secondaryKeys;
  if (!hasActiveHoverContext.value) return secondaryKeys;

  const directKeys = directNonExhibitionLineKeys.value;
  const centerPointLines = allLines.value.filter((line) => line.kind === "center-point");

  if (hoveredPoint.value) {
    for (const line of centerPointLines) {
      if (line.sourcePointKey !== hoveredPoint.value) continue;
      if (directKeys.has(line.key)) continue;
      secondaryKeys.add(line.key);
    }
  } else if (hoveredClusterId.value != null) {
    const hoveredId = Number(hoveredClusterId.value);
    for (const line of centerPointLines) {
      if (directKeys.has(line.key)) continue;
      const sourceClusterId = Number(line.sourceClusterId);
      const targetClusterId = Number(line.targetClusterId);
      if (targetClusterId === hoveredId && sourceClusterId !== hoveredId) {
        secondaryKeys.add(line.key);
      }
    }
  }

  return secondaryKeys;
});

const activeLineKeys = computed(() => {
  if (viewMode.value === "exhibitions" && hasActiveHoverContext.value) {
    return directExhibitionLineKeys.value;
  }
  if (viewMode.value !== "exhibitions" && hasActiveHoverContext.value) {
    return directNonExhibitionLineKeys.value;
  }
  if (!activeClusterIds.value.size) return new Set();
  return new Set(
    allLines.value
      .filter((line) => {
        const sourceActive = activeClusterIds.value.has(Number(line.sourceClusterId));
        const targetActive =
          line.targetClusterId != null &&
          activeClusterIds.value.has(Number(line.targetClusterId));
        return sourceActive || targetActive;
      })
      .map((line) => line.key),
  );
});

const activePointKeys = computed(() => {
  if (!activeClusterIds.value.size) return new Set();
  const keys = new Set();

  for (const [pk, details] of Object.entries(pointDetailsByKey.value)) {
    if (details.clusterId != null && activeClusterIds.value.has(Number(details.clusterId))) {
      keys.add(pk);
    }
  }
  for (const line of allLines.value) {
    if (!activeClusterIds.value.has(Number(line.sourceClusterId))) continue;
    if (line.targetPointKey) keys.add(line.targetPointKey);
  }
  return keys;
});

const hasActiveHoverContext = computed(
  () => activeClusterIds.value.size > 0 || hoveredPoint.value != null,
);

function isClusterActive(clusterId) {
  return activeClusterIds.value.has(Number(clusterId));
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
  const { x, y } = getClusterCanvasPos(group);
  return {
    left: `${x + box.left + box.width / 2}px`,
    top: `${y + box.top + box.height + CLUSTER_LABEL_GAP}px`,
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

// --- DOM geometry for lines (centers + dot anchors) ---
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

function resetCanvasTransitionState() {
  hoveredPoint.value = null;
  hoveredClusterId.value = null;
  clusterCenterPositions.value = {};
  pointPositions.value = {};
  renderEpoch.value += 1;
}

watch([viewMode, selectedN], () => {
  resetCanvasTransitionState();
  nextTick(() => {
    recalcPositions();
    requestAnimationFrame(() => recalcPositions());
  });
});

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
    n_clusters:
      viewMode.value === "exhibitions" ? exhibitionEntryCount : selectedN.value,
  });
}

function handleCenterClick(group) {
  const labels = (group.centerLabels ?? [])
    .map((label) => String(label ?? "").trim())
    .filter(Boolean);
  const clusterTitle = labels.length ? labels.join(", ") : group.name;

  const cid = group.clusterId;
  const sourceItems =
    viewMode.value === "exhibitions"
      ? (artistsByExhibitionId.value.get(cid) ?? []).map((a) => ({
          artistId: a.artistId,
          artistName: artistDisplayName(a.artistId),
        }))
      : (() => {
          const entry = currentClusterEntry.value;
          const acc = [];
          const seen = new Set();
          for (const item of group.items ?? []) {
            if (seen.has(item.artistId)) continue;
            seen.add(item.artistId);
            acc.push({
              artistId: item.artistId,
              artistName: item.artistName,
            });
          }
          for (const a of entry?.artists ?? []) {
            if (!(distributionMass(a.clusterDistribution, cid) > 0)) continue;
            if (seen.has(a.artistId)) continue;
            seen.add(a.artistId);
            acc.push({
              artistId: a.artistId,
              artistName: artistDisplayName(a.artistId),
            });
          }
          return acc;
        })();

  const seen = new Set();
  const uniqueArtists = [];
  for (const item of sourceItems) {
    if (seen.has(item.artistId)) continue;
    seen.add(item.artistId);
    uniqueArtists.push({
      artist: item.artistId,
      artistName: item.artistName,
    });
  }

  const isExhibitionMode = viewMode.value === "exhibitions";
  const keywords = group.centerLabels ?? [];
  const exhibitionHero = isExhibitionMode
    ? (exhibitionsById.get(cid) ?? null)
    : null;
  emit("select-cluster", {
    name: clusterTitle,
    items: uniqueArtists.map((a) => ({
      artist: a.artist == null ? a.artist : String(a.artist),
      artistName: a.artistName,
    })),
    n_clusters: isExhibitionMode ? exhibitionEntryCount : selectedN.value,
    keywords,
    clusterFeaturedQuote: group.featuredQuote ?? null,
    exhibitionHero,
  });
}

function displayLabelLine(i, group) {
  const raw = (group.centerLabels ?? [])[i];
  if (raw == null || raw === "") return "";
  return String(raw).toUpperCase();
}

function displayLabelLines(group) {
  const lines = [];
  for (let i = 0; i < CLUSTER_KEYWORDS_TO_SHOW; i += 1) {
    const line = displayLabelLine(i, group);
    if (line) lines.push(line);
  }
  return lines;
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
        :key="`svg-${renderEpoch}`"
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
            {
              'cluster-line--secondary':
                viewMode === 'exhibitions'
                  ? secondaryExhibitionLineKeys.has(line.key)
                  : secondaryNonExhibitionLineKeys.has(line.key),
            },
          ]"
        />
      </svg>

      <div
        v-for="group in layoutGroupsList"
        :key="`${renderEpoch}-${group.clusterId}`"
        class="cs-cluster-group"
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
        </div>

        <div
          v-if="isClusterActive(group.clusterId)"
          class="cs-center-labels"
          :style="getClusterLabelStyle(group)"
        >
          <span
            v-for="(line, idx) in displayLabelLines(group)"
            :key="`${group.clusterId}-label-${idx}`"
            class="cs-center-label-line"
          >{{ line }}</span>
          <span
            v-if="!displayLabelLines(group).length"
            class="cs-center-label-line cs-center-label-line--empty"
          >—</span>
        </div>

        <div
          v-for="(item, idx) in group.items"
          :key="pointKey(group, item, idx)"
          class="cs-point"
          :class="{
            'cs-point--hovered': hoveredPoint === pointKey(group, item, idx),
            'cs-point--active-cluster': activePointKeys.has(pointKey(group, item, idx)),
            'cs-point--dimmed':
              hasActiveHoverContext &&
              hoveredPoint !== pointKey(group, item, idx) &&
              !activePointKeys.has(pointKey(group, item, idx)),
          }"
          :style="getArtistStyle(item, group, idx)"
          :data-point-id="pointKey(group, item, idx)"
          :data-artist-id="item.artistId == null ? null : String(item.artistId)"
          :aria-label="item.artistName"
          @mouseenter="
            hoveredClusterId = group.clusterId;
            hoveredPoint = pointKey(group, item, idx);
          "
          @mouseleave="
            hoveredPoint = null;
            hoveredClusterId = null;
          "
          @click.stop="handlePointClick(item)"
        >
          <ArtistDot :artist-id="item.artistId" />
          <div
            v-if="activePointKeys.has(pointKey(group, item, idx))"
            class="cs-point-tag label-text"
          >
            {{ initialsFromName(item.artistName) }}
          </div>
          <div class="cs-tooltip">{{ item.artistName }}</div>
        </div>
      </div>
      <template v-if="surfaceSharedArtistItems.length">
        <div
          v-for="artist in surfaceSharedArtistItems"
          :key="`${renderEpoch}-shared-${artist.artistId}`"
          class="cs-point cs-point--shared"
          :class="{
            'cs-point--hovered': hoveredPoint === `shared-${artist.artistId}`,
            'cs-point--active-cluster': activePointKeys.has(`shared-${artist.artistId}`),
            'cs-point--dimmed':
              hasActiveHoverContext &&
              hoveredPoint !== `shared-${artist.artistId}` &&
              !activePointKeys.has(`shared-${artist.artistId}`),
          }"
          :style="getSharedArtistStyle(artist)"
          :data-point-id="`shared-${artist.artistId}`"
          :data-artist-id="String(artist.artistId)"
          :aria-label="artist.artistName"
          @mouseenter="hoveredPoint = `shared-${artist.artistId}`"
          @mouseleave="
            hoveredPoint = null;
            hoveredClusterId = null;
          "
          @click.stop="handlePointClick(artist)"
        >
          <ArtistDot :artist-id="artist.artistId" />
          <div
            v-if="activePointKeys.has(`shared-${artist.artistId}`)"
            class="cs-point-tag label-text"
          >
            {{ initialsFromName(artist.artistName) }}
          </div>
          <div class="cs-tooltip">{{ artist.artistName }}</div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped src="./style.css"></style>
