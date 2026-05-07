<script setup>
import {
  ref,
  computed,
  shallowRef,
  onMounted,
  onBeforeUnmount,
  nextTick,
  watch,
} from "vue";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { artistsById, artworks, exhibitionEntryCount, exhibitionsById } from "../../data/index.js";
import {
  CLUSTER_ART_MODE_DOT_SIZE_PX,
  DOT_SIZE_PX,
  REPRESENTATIVE_PERSONA_ARTIST_ID,
} from "../../constants.js";
import { publicImgSrc } from "../../utils/public-img-src.js";
import ArtistDot from "../ArtistDot/index.vue";
import ClusterArtistArtMark from "../ClusterArtistArtMark/index.vue";
import ClusterSectionHeading from "../ClusterSectionHeading/index.vue";
import { buildSessionArtModeCandidateMap } from "../../utils/cluster-art-mode-artwork.js";
import { setClusterArtModeActive } from "../../utils/cluster-art-mode-flag.js";
import {
  buildLineHoverHighlight,
} from "../../utils/cluster-hover-line-keys.js";

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

const CLUSTER_RADIUS = 118;
const CANVAS_PADDING_TOP = 0;
const CANVAS_PADDING_BOTTOM = 52;
const CANVAS_PADDING_X = 32;

function canvasInnerDimensions() {
  const w = Math.max(1, svgSize.value.width);
  const h = Math.max(1, svgSize.value.height);
  const innerW = Math.max(1, w - CANVAS_PADDING_X * 2);
  const innerH = Math.max(1, h - CANVAS_PADDING_TOP - CANVAS_PADDING_BOTTOM);
  return { w, h, innerW, innerH };
}

const CLUSTER_BOX_MIN_WIDTH = 150;
const CLUSTER_BOX_MIN_HEIGHT = 170;
const CLUSTER_BOX_PADDING = 18;
const CLUSTER_LABEL_GAP = 10;
const CLUSTER_KEYWORDS_TO_SHOW = 1;
const CLUSTER_SAFE_AREA_SCALE = 0.6;
const CLUSTER_SAFE_AREA_SHIFT_UP_PX = 48;
const PACK_FALLBACK_W = 960;
const PACK_FALLBACK_H = 720;

const CLUSTER_MODES = ["exhibitions", "artist", "institution"];

const viewMode = ref(
  CLUSTER_MODES.includes(props.initialViewMode) ? props.initialViewMode : "exhibitions",
);

function isArtistOrInstitutionMode() {
  const m = viewMode.value;
  return m === "artist" || m === "institution";
}
const selectedNIndex = ref(0);

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
  return sortedDistinctNFromList(list);
});

const selectedN = computed(() => availableN.value[selectedNIndex.value] ?? 0);

const showNAdjustControls = computed(() => isArtistOrInstitutionMode());
const displayedGroupCount = computed(() =>
  viewMode.value === "exhibitions" ? exhibitionEntryCount : selectedN.value,
);

const canDecrementGroupN = computed(
  () => showNAdjustControls.value && selectedNIndex.value > 0,
);
const canIncrementGroupN = computed(() => {
  const vals = availableN.value;
  return (
    showNAdjustControls.value &&
    vals.length > 0 &&
    selectedNIndex.value < vals.length - 1
  );
});

const artMode = ref(false);
const artModeEpoch = ref(0);
const sessionArtCandidateMap = shallowRef(new Map());
const EMPTY_ART_CANDIDATES = [];

watch(
  () => artworks.value,
  (list) => {
    if (!Array.isArray(list) || list.length === 0) return;
    if (sessionArtCandidateMap.value.size > 0) return;
    sessionArtCandidateMap.value = buildSessionArtModeCandidateMap(list);
  },
  { immediate: true },
);

function pointSizePx() {
  return artMode.value ? CLUSTER_ART_MODE_DOT_SIZE_PX : DOT_SIZE_PX;
}

const canvasDotSizeStyle = computed(() =>
  artMode.value ? { "--dot-size": `${CLUSTER_ART_MODE_DOT_SIZE_PX}px` } : {},
);

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

function sortedDistinctNFromList(list) {
  if (!Array.isArray(list) || !list.length) return [];
  return [...new Set(list.map((d) => Number(d.n)).filter(Number.isFinite))].sort(
    (a, b) => a - b,
  );
}

function summaryPropsForMode(mode) {
  if (mode === "institution") return props.institutionData;
  if (mode === "artist") return props.artistData;
  return null;
}

function applySelectedIndexForTargetN(mode, targetN) {
  if (mode === "exhibitions") return;
  const summary = summaryPropsForMode(mode);
  const list = Array.isArray(summary?.numClusters) ? summary.numClusters : [];
  const vals = sortedDistinctNFromList(list);
  if (!vals.length) return;
  if (targetN != null && vals.includes(targetN)) {
    selectedNIndex.value = vals.indexOf(targetN);
    return;
  }
  if (targetN != null) {
    const lower = [...vals].filter((v) => v <= targetN).pop();
    const pick = lower ?? vals[0];
    selectedNIndex.value = vals.indexOf(pick);
    return;
  }
  selectedNIndex.value = Math.min(
    selectedNIndex.value,
    Math.max(0, vals.length - 1),
  );
}

function setViewMode(mode) {
  if (!CLUSTER_MODES.includes(mode)) return;
  if (mode === viewMode.value) return;

  const prevMode = viewMode.value;
  let targetN = null;
  if (mode !== "exhibitions") {
    if (prevMode === "exhibitions") {
      targetN = exhibitionEntryCount;
    } else {
      targetN = selectedN.value;
    }
  }

  viewMode.value = mode;

  if (mode === "exhibitions") return;
  applySelectedIndexForTargetN(mode, targetN);
}

function decrementN() {
  const vals = availableN.value;
  if (!vals.length || viewMode.value === "exhibitions") return;
  selectedNIndex.value = Math.max(0, selectedNIndex.value - 1);
}

function incrementN() {
  const vals = availableN.value;
  if (!vals.length || viewMode.value === "exhibitions") return;
  selectedNIndex.value = Math.min(vals.length - 1, selectedNIndex.value + 1);
}

function clamp01(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

const SHARED_JITTER_PX = 24;
const POINT_JITTER_PX = 10;
const POINT_COLLISION_MAX_NUDGE = 18;

function visibleNormBounds() {
  const { innerW, innerH } = canvasInnerDimensions();
  const ps = pointSizePx();
  const ringPadPx =
    CLUSTER_RADIUS + ps * 0.5 + POINT_JITTER_PX + POINT_COLLISION_MAX_NUDGE;
  const minXBase = clamp01(ringPadPx / innerW, 0.012, 0.22);
  const minYTop = clamp01(ringPadPx / innerH, 0.012, 0.12);
  const bottomPadPx =
    CLUSTER_RADIUS * 0.78 +
    ps +
    CLUSTER_LABEL_GAP +
    CLUSTER_BOX_MIN_HEIGHT * 0.38 +
    POINT_JITTER_PX +
    POINT_COLLISION_MAX_NUDGE;
  const minYBottom = clamp01(bottomPadPx / innerH, 0.012, 0.11);

  const sy = clamp01(CLUSTER_SAFE_AREA_SCALE, 0.35, 1);
  const targetMinY = (1 - sy) / 2;
  const minX = minXBase;
  const minYBase = Math.max(minYTop, targetMinY);
  const maxYBase = 1 - Math.max(minYBottom, targetMinY);
  const shiftNorm = CLUSTER_SAFE_AREA_SHIFT_UP_PX / innerH;
  const minY = Math.max(0, minYBase - shiftNorm);
  const maxY = Math.max(minY + 1e-6, maxYBase - shiftNorm);
  return {
    minX,
    maxX: 1 - minX,
    minY,
    maxY,
  };
}

function normToCanvas(x, y) {
  const { w, h } = canvasInnerDimensions();
  return {
    x: CANVAS_PADDING_X + x * (w - CANVAS_PADDING_X * 2),
    y: CANVAS_PADDING_TOP + y * (h - CANVAS_PADDING_TOP - CANVAS_PADDING_BOTTOM),
  };
}

function gridCellIndexBySortedClusterId(clusterId, clusterIds) {
  const id = Number(clusterId);
  if (!Number.isFinite(id)) return 0;
  const sorted = [...new Set(clusterIds.map(Number).filter(Number.isFinite))].sort(
    (a, b) => a - b,
  );
  const idx = sorted.indexOf(id);
  return idx >= 0 ? idx : 0;
}

/**
 * Evenly distributes k cluster centers across the visible safe rectangle.
 * Partial last rows use the same horizontal pitch as full rows and are centered.
 */
function clusterLayoutNormXY(k, cellIndex) {
  const cols = Math.max(1, Math.ceil(Math.sqrt(k)));
  const rows = Math.ceil(k / cols);
  const row = Math.floor(cellIndex / cols);
  const colInRow = cellIndex % cols;
  const nInRow = row === rows - 1 ? k - row * cols : cols;

  const b = visibleNormBounds();
  const spanX = b.maxX - b.minX;
  const spanY = b.maxY - b.minY;

  let nxCell;
  if (cols === 1) {
    nxCell = 0.5;
  } else {
    const step = 1 / (cols - 1);
    if (nInRow <= 1) {
      nxCell = 0.5;
    } else {
      const blockWidth = (nInRow - 1) * step;
      const start = (1 - blockWidth) / 2;
      nxCell = start + colInRow * step;
    }
  }

  let nyCell;
  if (rows === 1) {
    nyCell = 0.5;
  } else {
    nyCell = (row / (rows - 1)) * 1;
  }

  return {
    normX: b.minX + nxCell * spanX,
    normY: b.minY + nyCell * spanY,
  };
}

const SHARED_BLEND_GAP = 0.15;
const PRIMARY_LINE_GAP = 0.1;
const MIN_ASSOCIATION_WEIGHT = 0.02;

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
  return w > MIN_ASSOCIATION_WEIGHT && w >= wPrimary - PRIMARY_LINE_GAP;
}

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
  const x = pos.x + nudge.dx;
  const y = pos.y + nudge.dy;
  if (artMode.value) {
    return {
      left: `${x}px`,
      top: `${y}px`,
      transform: "translate(-50%, -50%)",
    };
  }
  const ps = pointSizePx();
  return {
    left: `${x - ps / 2}px`,
    top: `${y - ps / 2}px`,
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
    if (numericWeight > MIN_ASSOCIATION_WEIGHT) ids.push(numericId);
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
  if (!isArtistOrInstitutionMode()) return [];
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

const surfaceSharedArtistItems = computed(() =>
  viewMode.value === "exhibitions"
    ? sharedArtistItems.value
    : isArtistOrInstitutionMode()
      ? clusterSharedArtistItems.value
      : [],
);

const layoutGroups = computed(() => {
  if (viewMode.value === "exhibitions") {
    const exRows = normalizedExhibitionData.value.exhibitions ?? [];
    const k = exRows.length;
    const out = {};
    if (!k) return out;

    const clusterIds = exRows.map((ex) => Number(ex.id));
    exRows.forEach((ex) => {
      const clusterId = Number(ex.id);
      const cellIdx = gridCellIndexBySortedClusterId(clusterId, clusterIds);
      const { normX, normY } = clusterLayoutNormXY(k, cellIdx);

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
    (a, b) => Number(a.gridIndex) - Number(b.gridIndex) || Number(a.id) - Number(b.id),
  );
  const k = groups.length;
  if (!k) return out;

  const clusterIds = groups.map((g) => Number(g.id));
  groups.forEach((g) => {
    const clusterId = Number(g.id);
    const cellIdx = gridCellIndexBySortedClusterId(clusterId, clusterIds);
    const { normX, normY } = clusterLayoutNormXY(k, cellIdx);
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

function artCandidatesForArtist(artistId) {
  const id = Number(artistId);
  if (!Number.isFinite(id)) return EMPTY_ART_CANDIDATES;
  return sessionArtCandidateMap.value.get(id) ?? EMPTY_ART_CANDIDATES;
}

function toggleArtMode() {
  artMode.value = !artMode.value;
}

watch(artMode, (on) => {
  if (on) {
    artModeEpoch.value += 1;
    setClusterArtModeActive(true);
    nextTick(() => {
      requestAnimationFrame(() => ScrollTrigger.refresh());
    });
  } else {
    setClusterArtModeActive(false);
    nextTick(() => {
      requestAnimationFrame(() => ScrollTrigger.refresh());
    });
  }
});

function getClusterCanvasPos(group) {
  if (
    !group ||
    typeof group.normX !== "number" ||
    typeof group.normY !== "number"
  ) {
    return { x: CANVAS_PADDING_X, y: CANVAS_PADDING_TOP };
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
  const x =
    cx +
    Math.cos(angle) * r +
    Math.cos(jitterAngle) * POINT_JITTER_PX +
    nudge.dx;
  const y =
    cy +
    Math.sin(angle) * r +
    Math.sin(jitterAngle) * POINT_JITTER_PX +
    nudge.dy;
  if (artMode.value) {
    return {
      left: `${x}px`,
      top: `${y}px`,
      transform: "translate(-50%, -50%)",
    };
  }
  const ps = pointSizePx();
  return {
    left: `${x - ps / 2}px`,
    top: `${y - ps / 2}px`,
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

  const minDist = pointSizePx() * 0.95;
  const out = {};
  const placed = [];
  for (const p of points) {
    let x = p.x;
    let y = p.y;
    for (const q of placed) {
      const dx = x - q.x;
      const dy = y - q.y;
      const d = Math.hypot(dx, dy);
      if (d >= minDist) continue;
      const overlap = minDist - d;
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
  } else if (isArtistOrInstitutionMode()) {
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

const hoveredPointDetails = computed(() =>
  hoveredPoint.value ? pointDetailsByKey.value[hoveredPoint.value] : null,
);

const activeClusterIds = computed(() => {
  const ids = new Set();
  const d = hoveredPointDetails.value;
  if (d) {
    if (Array.isArray(d.clusterIds)) {
      const primaryId = Number(d.primaryCluster ?? d.clusterId);
      const filterPrimary = isArtistOrInstitutionMode();
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
      } else if (isArtistOrInstitutionMode()) {
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

const hasActiveHoverContext = computed(
  () => activeClusterIds.value.size > 0 || hoveredPoint.value != null,
);

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

  if (isArtistOrInstitutionMode()) {
    for (const artist of clusterSharedArtistItems.value) {
      const pk = `shared-${artist.artistId}`;
      const pt = pts[pk];
      if (!pt) continue;
      const pId = Number(artist.primaryCluster);
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

const LINE_HOVER_EMPTY = { direct: new Set(), secondary: new Set() };

const lineHoverHighlight = computed(() => {
  if (!hasActiveHoverContext.value) return LINE_HOVER_EMPTY;
  return buildLineHoverHighlight({
    viewMode: viewMode.value,
    allLines: allLines.value,
    hoveredPoint: hoveredPoint.value,
    hoveredClusterId: hoveredClusterId.value,
    pointDetailsByKey: pointDetailsByKey.value,
    primaryLikePoint,
    activeClusterIds: activeClusterIds.value,
  });
});

const activeLineKeys = computed(() => lineHoverHighlight.value.direct);

const activePointKeys = computed(() => {
  if (!hasActiveHoverContext.value) return new Set();
  const keys = new Set();
  if (hoveredPoint.value) keys.add(hoveredPoint.value);
  const { direct, secondary } = lineHoverHighlight.value;
  for (const line of allLines.value) {
    if (!direct.has(line.key) && !secondary.has(line.key)) continue;
    if (line.sourcePointKey) keys.add(line.sourcePointKey);
    if (line.targetPointKey) keys.add(line.targetPointKey);
  }
  return keys;
});

const clusterIdsWithVisibleHoverLines = computed(() => {
  const ids = new Set();
  if (!hasActiveHoverContext.value) return [];

  const { direct, secondary } = lineHoverHighlight.value;
  let anyHighlightedLine = false;

  for (const line of allLines.value) {
    const isActive = direct.has(line.key);
    const isSecondary = secondary.has(line.key);
    if (!isActive && !isSecondary) continue;

    anyHighlightedLine = true;
    const s = Number(line.sourceClusterId);
    const t = Number(line.targetClusterId);
    if (Number.isFinite(s)) ids.add(s);
    if (Number.isFinite(t)) ids.add(t);

    if (line.kind === "point-point" && line.targetPointKey) {
      const d = pointDetailsByKey.value[line.targetPointKey];
      if (d?.clusterId != null) ids.add(Number(d.clusterId));
      if (Array.isArray(d?.clusterIds)) {
        for (const c of d.clusterIds) {
          const n = Number(c);
          if (Number.isFinite(n)) ids.add(n);
        }
      }
    }
  }

  if (anyHighlightedLine && ids.size === 0) {
    for (const id of activeClusterIds.value) ids.add(Number(id));
  }

  return Array.from(ids);
});

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
  const ps = pointSizePx();
  let minX = -ps / 2;
  let maxX = ps / 2;
  let minY = -ps / 2;
  let maxY = ps / 2;

  for (const item of group.items ?? []) {
    const r = (item._radius_frac ?? 0.5) * CLUSTER_RADIUS;
    const angle = item._angle ?? 0;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    minX = Math.min(minX, x - ps / 2);
    maxX = Math.max(maxX, x + ps / 2);
    minY = Math.min(minY, y - ps / 2);
    maxY = Math.max(maxY, y + ps / 2);
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
  setClusterArtModeActive(false);
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

function displayLabelLines(group) {
  const lines = [];
  const labels = group.centerLabels ?? [];
  for (let i = 0; i < CLUSTER_KEYWORDS_TO_SHOW; i += 1) {
    const raw = labels[i];
    if (raw == null || raw === "") continue;
    lines.push(String(raw).toUpperCase());
  }
  return lines;
}
</script>

<template>
  <div class="cluster-section-root">
    <ClusterSectionHeading
      :view-mode="viewMode"
      :show-n-adjust-controls="showNAdjustControls"
      :can-decrement-group-n="canDecrementGroupN"
      :can-increment-group-n="canIncrementGroupN"
      :group-count="displayedGroupCount"
      @change-view-mode="setViewMode"
      @decrement-n="decrementN"
      @increment-n="incrementN"
    />

    <button
      type="button"
      class="cluster-section__art-mode-btn label-text"
      :class="{ 'cluster-section__art-mode-btn--active': artMode }"
      :aria-pressed="artMode"
      aria-label="Toggle art mode"
      @click="toggleArtMode"
    >
      Art mode
    </button>

    <div
      ref="sectionRef"
      class="cluster-section-canvas"
      :style="canvasDotSizeStyle"
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
            { 'cluster-line--secondary': lineHoverHighlight.secondary.has(line.key) },
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
            :class="{
              'cs-center-dot--visible': clusterIdsWithVisibleHoverLines.includes(
                Number(group.clusterId),
              ),
            }"
            :data-cluster-center="group.clusterId"
            aria-hidden="true"
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
            'cs-point--art': artMode,
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
          <ClusterArtistArtMark
            v-if="artMode"
            :candidates="artCandidatesForArtist(item.artistId)"
            :mode-epoch="artModeEpoch"
          />
          <ArtistDot v-else :artist-id="item.artistId" />
          <div v-if="!artMode" class="cs-point-tag label-text">
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
            'cs-point--art': artMode,
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
          <ClusterArtistArtMark
            v-if="artMode"
            :candidates="artCandidatesForArtist(artist.artistId)"
            :mode-epoch="artModeEpoch"
          />
          <ArtistDot v-else :artist-id="artist.artistId" />
          <div v-if="!artMode" class="cs-point-tag label-text">
            {{ initialsFromName(artist.artistName) }}
          </div>
          <div class="cs-tooltip">{{ artist.artistName }}</div>
        </div>
      </template>
    </div>

    <div class="cluster-section-footer" aria-label="Visualization key">
      <div class="cluster-section-key">
        <div class="cluster-section-key__row">
          <span class="cluster-section-key__marker cluster-section-key__marker--artist">
            <template v-if="artMode">
              <img
                class="cluster-section-key__artwork"
                :src="publicImgSrc('artwork.svg')"
                alt=""
                width="28"
                height="24"
              />
            </template>
            <template v-else>
              <span class="cluster-section-key__persona-dot">
                <ArtistDot :artist-id="REPRESENTATIVE_PERSONA_ARTIST_ID" />
              </span>
              <span class="cluster-section-key__initials">WT</span>
            </template>
          </span>
          <span class="cluster-section-key__text">
            <span class="cluster-section-key__equals">=</span>
            <span class="cluster-section-key__copy">{{
              artMode ? "artist + work" : "artist + initials"
            }}</span>
          </span>
        </div>
        <div class="cluster-section-key__row">
          <span class="cluster-section-key__marker cluster-section-key__marker--line-pair">
            <span class="cluster-section-key__line cluster-section-key__line--primary" />
            <span class="cluster-section-key__line cluster-section-key__line--secondary" />
          </span>
          <span class="cluster-section-key__text">
            <span class="cluster-section-key__equals">=</span>
            <span class="cluster-section-key__copy">strength of connection</span>
          </span>
        </div>
        <div class="cluster-section-key__row">
          <span class="cluster-section-key__marker cluster-section-key__marker--anchor">
            <span class="cluster-section-key__box" />
            <span class="cluster-section-key__anchor-label">LABEL</span>
          </span>
          <span class="cluster-section-key__text">
            <span class="cluster-section-key__equals">=</span>
            <span class="cluster-section-key__copy">group anchor + keywords</span>
          </span>
        </div>
        <div class="cluster-section-key__row">
          <span class="cluster-section-key__marker cluster-section-key__marker--line-pair">
            <span
              class="cluster-section-key__line cluster-section-key__line--similarity-strong"
            />
            <span
              class="cluster-section-key__line cluster-section-key__line--similarity-weak"
            />
          </span>
          <span class="cluster-section-key__text">
            <span class="cluster-section-key__equals">=</span>
            <span class="cluster-section-key__copy">similarity to group anchor</span>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped src="./style.css"></style>
