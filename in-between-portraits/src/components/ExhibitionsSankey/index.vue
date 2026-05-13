<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import * as d3 from "d3";
import { sankey as d3Sankey, sankeyLinkHorizontal, sankeyLeft } from "d3-sankey";
import { createTooltip } from "../../utils/d3/tooltip.js";
import {
  artistTooltipShowOptions,
  exhibitionTooltipShowOptions,
} from "../../utils/exhibition-tooltip.js";
import { exhibitionStartYear, parseArtistIds } from "../../utils/exhibition-data.js";
import {
  EXHIBITIONS_SANKEY_BRIDGE_ATTR,
  EXHIBITIONS_SANKEY_LABEL_OFFSET_PX,
  EXHIBITIONS_VIZ_CONFIG,
  exhibitionMarkHeightPx,
} from "../../constants/exhibitions-viz.js";
import {
  CSS_LETTER_SPACING_UI,
  DOT_SIZE_PX,
  FONT_BODY,
  FONT_SIZE_UI_PX,
} from "../../constants.js";
import { getArtistDotData } from "../../utils/artist-dot.js";
import exhibitionsCSV from "../../data/exhibitions.csv?raw";
import artistsCSV from "../../data/artists.csv?raw";
import artworksCSV from "../../data/artworks.csv?raw";
import institutionsCSV from "../../data/institutions.csv?raw";

const NODE_WIDTH = EXHIBITIONS_VIZ_CONFIG.layout.nodeSizePx;
const NODE_PADDING = 36;
const LABEL_OFFSET_PX = EXHIBITIONS_SANKEY_LABEL_OFFSET_PX;
const LABEL_LINE_HEIGHT_EM = 1.1;
const LABEL_SINGLE_LINE_DY_EM = 0.35;
const LINK_STROKE = EXHIBITIONS_VIZ_CONFIG.stroke.linkPx;
const BASE_REQUIRED_HEIGHT = 600;

const containerRef = ref(null);
let destroyTooltip = null;

const artistsById = computed(() => {
  const rows = d3.csvParse(artistsCSV);
  const map = {};
  rows.forEach((r) => (map[r.id] = r));
  return map;
});

const institutionNamesByArtistId = computed(() => {
  const instName = {};
  for (const r of d3.csvParse(institutionsCSV)) {
    const id = String(r.id ?? "").trim();
    if (id) instName[id] = String(r.name || "").trim();
  }
  const byArtist = {};
  for (const row of d3.csvParse(artworksCSV)) {
    const aid = String(row.artist ?? "").trim();
    const name = instName[String(row.institution ?? "").trim()];
    if (!aid || !name) continue;
    if (!byArtist[aid]) byArtist[aid] = new Set();
    byArtist[aid].add(name);
  }
  const out = {};
  for (const [aid, set] of Object.entries(byArtist)) {
    out[aid] = [...set].sort((a, b) => a.localeCompare(b));
  }
  return out;
});

function artistLifeLine(row) {
  if (!row) return null;
  const by = String(row.birth_year ?? "").trim();
  const dy = String(row.death_year ?? "").trim();
  if (!by) return null;
  if (dy) return `(${by} - ${dy})`;
  return `(${by} - )`;
}

const EXHIBITION_LINE_MAX_CHARS = 26;
const WRAP_EXTRA_LINE_WEIGHT = 7;

function wrapGreedyWords(trimmed, max) {
  const words = trimmed.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";

  function flushWordTooLong(word) {
    if (current) {
      lines.push(current);
      current = "";
    }
    for (let i = 0; i < word.length; i += max) {
      lines.push(word.slice(i, i + max));
    }
  }

  for (const word of words) {
    if (word.length > max) {
      flushWordTooLong(word);
      continue;
    }
    const trial = current ? `${current} ${word}` : word;
    if (trial.length <= max) {
      current = trial;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [trimmed];
}

function expandOversizedWords(words, max) {
  const out = [];
  for (const w of words) {
    if (w.length <= max) out.push(w);
    else {
      for (let i = 0; i < w.length; i += max) out.push(w.slice(i, i + max));
    }
  }
  return out;
}

function minLinesForWords(words, max) {
  const n = words.length;
  if (n === 0) return 0;
  const dp = Array(n + 1).fill(Infinity);
  dp[0] = 0;
  for (let end = 1; end <= n; end++) {
    for (let start = 0; start < end; start++) {
      const seg = words.slice(start, end).join(" ");
      if (seg.length > max) continue;
      if (Number.isFinite(dp[start])) {
        dp[end] = Math.min(dp[end], dp[start] + 1);
      }
    }
  }
  return dp[n];
}

function lineLengthRange(lines) {
  const lens = lines.map((l) => l.trim().length);
  if (!lens.length) return 0;
  return Math.max(...lens) - Math.min(...lens);
}

function lineLengthVarianceScore(lines) {
  const lens = lines.map((l) => l.trim().length);
  if (!lens.length) return 0;
  const mean = lens.reduce((a, b) => a + b, 0) / lens.length;
  return lens.reduce((acc, len) => acc + (len - mean) ** 2, 0);
}

function wrapBalancedWordsForK(words, max, k) {
  const n = words.length;
  if (k < 1 || n === 0) return null;
  if (k === 1) {
    const one = words.join(" ");
    return one.length <= max ? [one] : null;
  }

  const lens = words.map((word) => word.length);
  const prefix = [0];
  for (let i = 0; i < n; i++) prefix.push(prefix[i] + lens[i]);

  function segmentLength(i, jExclusive) {
    const wordsLen = prefix[jExclusive] - prefix[i];
    const spaces = Math.max(0, jExclusive - i - 1);
    return wordsLen + spaces;
  }

  const targetLen = words.join(" ").length / k;
  const dp = Array.from({ length: k + 1 }, () => Array(n + 1).fill(Infinity));
  const prev = Array.from({ length: k + 1 }, () => Array(n + 1).fill(-1));
  dp[0][0] = 0;

  for (let line = 1; line <= k; line++) {
    for (let end = 1; end <= n; end++) {
      for (let start = 0; start < end; start++) {
        if (!Number.isFinite(dp[line - 1][start])) continue;
        const len = segmentLength(start, end);
        if (len > max) continue;
        const cost = dp[line - 1][start] + (len - targetLen) ** 2;
        if (cost < dp[line][end]) {
          dp[line][end] = cost;
          prev[line][end] = start;
        }
      }
    }
  }

  if (!Number.isFinite(dp[k][n])) return null;

  const lines = [];
  let end = n;
  for (let line = k; line >= 1; line--) {
    const start = prev[line][end];
    if (start < 0) return null;
    lines.push(words.slice(start, end).join(" "));
    end = start;
  }
  lines.reverse();
  return lines.length ? lines : null;
}

function balanceWordLines(words, max) {
  const expanded = expandOversizedWords(words, max);
  if (!expanded.length) return [];
  const joined = expanded.join(" ");
  if (joined.length <= max) return [joined];

  const minK = minLinesForWords(expanded, max);
  if (!Number.isFinite(minK) || minK < 1) {
    return wrapGreedyWords(joined, max);
  }

  const maxKTry = Math.min(minK + 2, expanded.length);
  let bestLines = null;
  let bestScore = Infinity;
  let bestRange = Infinity;
  let bestK = Infinity;

  for (let k = minK; k <= maxKTry; k++) {
    const candidate = wrapBalancedWordsForK(expanded, max, k);
    if (!candidate) continue;
    const range = lineLengthRange(candidate);
    const variance = lineLengthVarianceScore(candidate);
    const extra = Math.max(0, k - minK);
    const score = (range + extra * WRAP_EXTRA_LINE_WEIGHT) * 1000 + variance;
    if (
      score < bestScore ||
      (score === bestScore && range < bestRange) ||
      (score === bestScore && range === bestRange && k < bestK)
    ) {
      bestLines = candidate;
      bestScore = score;
      bestRange = range;
      bestK = k;
    }
  }

  return bestLines?.length ? bestLines : wrapGreedyWords(joined, max);
}

function fixWidowLastLine(lines, max) {
  if (lines.length < 2) return lines;

  const MERGE_ORPHAN_MAX_LEN = 5;

  const last = lines[lines.length - 1].trim();
  const prev = lines[lines.length - 2].trim();
  const lastWords = last.split(/\s+/).filter(Boolean);
  if (lastWords.length !== 1) return lines;

  const orphan = lastWords[0];

  if (orphan.length <= MERGE_ORPHAN_MAX_LEN) {
    const merged = `${prev} ${orphan}`;
    if (merged.length <= max) {
      return [...lines.slice(0, -2), merged];
    }
  }

  const prevWords = prev.split(/\s+/).filter(Boolean);
  if (prevWords.length < 2) return lines;

  const newPrev = prevWords.slice(0, -1).join(" ");
  const newLast = `${prevWords[prevWords.length - 1]} ${orphan}`;
  if (newPrev.length <= max && newLast.length <= max) {
    return [...lines.slice(0, -2), newPrev, newLast];
  }

  return lines;
}

function wrapExhibitionTitle(name) {
  const max = EXHIBITION_LINE_MAX_CHARS;
  const trimmed = name.trim();
  if (!trimmed) return [name];
  if (trimmed.length <= max) return [trimmed];

  const colonIdx = trimmed.indexOf(":");
  const allWords = trimmed.split(/\s+/).filter(Boolean);
  let lines;
  if (colonIdx > 0 && colonIdx < trimmed.length - 1) {
    const prefix = trimmed.slice(0, colonIdx + 1).trim();
    const rest = trimmed.slice(colonIdx + 1).trim();
    if (!rest.length) {
      lines = prefix.length <= max ? [prefix] : balanceWordLines(allWords, max);
    } else if (prefix.length <= max) {
      const words = [prefix, ...rest.split(/\s+/).filter(Boolean)];
      lines = balanceWordLines(words, max);
    } else {
      lines = balanceWordLines(allWords, max);
    }
  } else {
    lines = balanceWordLines(allWords, max);
  }

  return fixWidowLastLine(lines, max);
}

function drawNodeLabel(g, d) {
  const y = (d.y0 + d.y1) / 2;
  const x = d.type === "exhibition" ? d.x0 - LABEL_OFFSET_PX : d.x1 + LABEL_OFFSET_PX;
  const anchor = d.type === "exhibition" ? "end" : "start";

  const text = g
    .append("text")
    .attr("class", "sankey-node-label")
    .attr("x", x)
    .attr("y", y)
    .attr("text-anchor", anchor)
    .attr("fill", "#fff")
    .style("font-family", FONT_BODY)
    .style("font-size", `${FONT_SIZE_UI_PX}px`)
    .style("letter-spacing", CSS_LETTER_SPACING_UI)
    .style("cursor", "default")
    .style("user-select", "none")
    .style("-webkit-user-select", "none");

  if (d.type !== "exhibition") {
    text.attr("dy", `${LABEL_SINGLE_LINE_DY_EM}em`).text(d.name);
    return;
  }

  const lines = wrapExhibitionTitle(d.name);
  if (lines.length === 1) {
    text.attr("dy", `${LABEL_SINGLE_LINE_DY_EM}em`).text(lines[0]);
    return;
  }

  text
    .append("tspan")
    .attr("x", x)
    .attr("dy", `${-((lines.length - 1) * LABEL_LINE_HEIGHT_EM) / 4}em`)
    .text(lines[0]);

  for (let i = 1; i < lines.length; i++) {
    text
      .append("tspan")
      .attr("x", x)
      .attr("dy", `${LABEL_LINE_HEIGHT_EM}em`)
      .text(lines[i]);
  }
}

const graphData = computed(() => {
  const instByArtist = institutionNamesByArtistId.value;
  const exhibitionRows = d3.csvParse(exhibitionsCSV);
  const exhibitions = exhibitionRows.map((r) => ({
    id: r.id,
    name: r.name || "Untitled Exhibition",
    location: r.location || "",
    startYear: exhibitionStartYear(r.date_start),
    artistIds: parseArtistIds(r.artists),
  }));

  const artistIdSet = new Set();
  exhibitions.forEach((e) => e.artistIds.forEach((id) => artistIdSet.add(id)));

  const nodes = [
    ...exhibitions.map((e) => ({
      nodeId: `ex-${e.id}`,
      name: e.name,
      location: e.location,
      startYear: e.startYear,
      artistCount: e.artistIds.length,
      type: "exhibition",
    })),
    ...[...artistIdSet].map((id) => {
      const row = artistsById.value[id];
      const fallback = `Artist ${id}`;
      return {
        nodeId: `ar-${id}`,
        name: row?.name || fallback,
        lifeLine: artistLifeLine(row),
        institutionNames: instByArtist[id] ?? [],
        type: "artist",
      };
    }),
  ];

  const nodeIndex = {};
  nodes.forEach((n, i) => (nodeIndex[n.nodeId] = i));

  const links = [];
  exhibitions.forEach((e) => {
    e.artistIds.forEach((aid) => {
      links.push({
        source: nodeIndex[`ex-${e.id}`],
        target: nodeIndex[`ar-${aid}`],
        value: 1,
      });
    });
  });

  return { nodes, links };
});

function renderChart() {
  const root = containerRef.value;
  if (!root) return;
  destroyTooltip?.();
  destroyTooltip = null;
  d3.select(root).selectAll("*").remove();

  const { nodes, links } = graphData.value;
  if (!nodes.length) return;

  const width = root.clientWidth || 900;
  const baseHeight = root.clientHeight || BASE_REQUIRED_HEIGHT;
  const margin = EXHIBITIONS_VIZ_CONFIG.layout.margin;
  const exhibitionCount = nodes.filter((d) => d.type === "exhibition").length;
  const artistCount = nodes.filter((d) => d.type === "artist").length;
  const densestColumnCount = Math.max(exhibitionCount, artistCount, 1);
  const requiredPlotHeight =
    densestColumnCount * NODE_WIDTH + (densestColumnCount - 1) * NODE_PADDING;
  const requiredHeight = Math.ceil(requiredPlotHeight + margin.top + margin.bottom);
  const height = Math.max(baseHeight, requiredHeight);

  const sankeyLayout = d3Sankey()
    .nodeWidth(NODE_WIDTH)
    .nodePadding(NODE_PADDING)
    .nodeAlign(sankeyLeft)
    .extent([
      [margin.left, margin.top],
      [width - margin.right, height - margin.bottom],
    ]);

  const graph = sankeyLayout({
    nodes: nodes.map((d) => ({ ...d })),
    links: links.map((d) => ({ ...d })),
  });

  const sampleExhibition = graph.nodes.find((d) => d.type === "exhibition");
  const sampleArtist = graph.nodes.find((d) => d.type === "artist");
  const exhibitionLabelAnchorX = sampleExhibition
    ? sampleExhibition.x0 - LABEL_OFFSET_PX
    : margin.left + NODE_WIDTH - LABEL_OFFSET_PX;
  const artistLabelAnchorX = sampleArtist
    ? sampleArtist.x1 + LABEL_OFFSET_PX
    : width - margin.right + LABEL_OFFSET_PX;

  const svg = d3
    .select(root)
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .attr(EXHIBITIONS_SANKEY_BRIDGE_ATTR.exhibitionLabelAnchorX, String(exhibitionLabelAnchorX))
    .attr(EXHIBITIONS_SANKEY_BRIDGE_ATTR.artistLabelAnchorX, String(artistLabelAnchorX));

  const { show, hide, destroy } = createTooltip(root);
  destroyTooltip = destroy;
  let hoveredNodeId = null;

  function tooltipOptionsForNode(d) {
    if (d.type === "exhibition") {
      return exhibitionTooltipShowOptions(d);
    }
    return artistTooltipShowOptions(d);
  }

  function connectedContext(nodeId) {
    const activeLinkKeys = new Set();
    const activeNodeIds = new Set([nodeId]);
    for (const link of graph.links) {
      const sourceId = link.source?.nodeId;
      const targetId = link.target?.nodeId;
      const isConnected = sourceId === nodeId || targetId === nodeId;
      if (!isConnected) continue;
      activeLinkKeys.add(`${sourceId}->${targetId}`);
      if (sourceId) activeNodeIds.add(sourceId);
      if (targetId) activeNodeIds.add(targetId);
    }
    return { activeLinkKeys, activeNodeIds };
  }

  const linkSelection = svg
    .append("g")
    .selectAll("path")
    .data(graph.links)
    .enter()
    .append("path")
    .attr("d", sankeyLinkHorizontal())
    .attr("fill", "none")
    .attr("stroke", "#fff")
    .attr("stroke-width", LINK_STROKE)
    .attr("stroke-opacity", 1)
    .style("pointer-events", "none");

  const nodeGroup = svg
    .append("g")
    .selectAll("g")
    .data(graph.nodes)
    .enter()
    .append("g");

  function nodeFill(d) {
    return d.type === "exhibition" ? "#fff" : "#000";
  }

  function nodeFillHover(d) {
    return d.type === "exhibition" ? "#fff" : "#111";
  }

  function exhibitionNodeHeight(d) {
    return exhibitionMarkHeightPx(d.artistCount);
  }

  const exhibitionNodes = nodeGroup
    .filter((d) => d.type === "exhibition")
    .append("rect")
    .attr("class", "sankey-node-mark")
    .attr("data-node-id", (d) => d.nodeId)
    .attr("data-exhibition-id", (d) => d.nodeId.slice(3))
    .attr("x", (d) => d.x0)
    .attr("y", (d) => (d.y0 + d.y1) / 2 - exhibitionNodeHeight(d) / 2)
    .attr("height", exhibitionNodeHeight)
    .attr("width", (d) => d.x1 - d.x0)
    .attr("fill", nodeFill)
    .attr("stroke", "#fff")
    .attr("stroke-width", 1)
    .attr("rx", EXHIBITIONS_VIZ_CONFIG.layout.nodeRadiusPx)
    .style("cursor", "default");

  function artistDotTransform(d) {
    const dot = getArtistDotData(d.nodeId.slice(3));
    if (!dot) return null;
    const [, , vbW, vbH] = dot.viewBox.split(/\s+/).map(Number);
    const scale = DOT_SIZE_PX / Math.max(vbW, vbH);
    const cx = (d.x0 + d.x1) / 2 - 3;
    const cy = (d.y0 + d.y1) / 2;
    const tx = cx - (vbW * scale) / 2;
    const ty = cy - (vbH * scale) / 2;
    return `translate(${tx}, ${ty}) scale(${scale})`;
  }

  const artistNodes = nodeGroup
    .filter((d) => d.type === "artist")
    .append("g")
    .attr("class", "sankey-node-mark")
    .attr("data-node-id", (d) => d.nodeId)
    .attr("data-artist-id", (d) => d.nodeId.slice(3))
    .attr("transform", (d) => artistDotTransform(d) || "")
    .attr("fill", nodeFill)
    .attr("stroke", "#fff")
    .attr("stroke-width", 1)
    .style("cursor", "default");

  artistNodes
    .append("path")
    .attr("d", (d) => getArtistDotData(d.nodeId.slice(3))?.d || "")
    .attr("vector-effect", "non-scaling-stroke");

  // Increase hover affordance for tiny artist dots.
  nodeGroup
    .filter((d) => d.type === "artist")
    .append("circle")
    .attr("class", "sankey-node-hit")
    .attr("cx", (d) => (d.x0 + d.x1) / 2 - 3)
    .attr("cy", (d) => (d.y0 + d.y1) / 2)
    .attr("r", Math.max(DOT_SIZE_PX, 8))
    .attr("fill", "transparent")
    .style("cursor", "default");

  function applyHoverState(nodeId = null) {
    hoveredNodeId = nodeId;
    if (!nodeId) {
      linkSelection
        .attr("stroke-opacity", 1)
        .attr("stroke-width", LINK_STROKE);
      svg
        .selectAll(".sankey-node-mark")
        .attr("stroke-opacity", 1)
        .attr("opacity", 1)
        .attr("stroke-width", 1)
        .attr("fill", (d) => nodeFill(d));
      svg.selectAll(".sankey-node-label").attr("opacity", 1).style("font-weight", 400);
      return;
    }

    const { activeLinkKeys, activeNodeIds } = connectedContext(nodeId);
    linkSelection
      .attr("stroke-opacity", (d) =>
        activeLinkKeys.has(`${d.source?.nodeId}->${d.target?.nodeId}`) ? 1 : 0.4,
      )
      .attr("stroke-width", (d) =>
        activeLinkKeys.has(`${d.source?.nodeId}->${d.target?.nodeId}`)
          ? LINK_STROKE + 0.35
          : LINK_STROKE,
      );
    svg
      .selectAll("rect.sankey-node-mark")
      .attr("opacity", (d) => (activeNodeIds.has(d.nodeId) ? 1 : 0.25))
      .attr("stroke-width", (d) => (d.nodeId === nodeId ? 2 : 1))
      .attr("fill", (d) =>
        d.nodeId === nodeId || activeNodeIds.has(d.nodeId) ? nodeFillHover(d) : nodeFill(d),
      );
    svg
      .selectAll("g.sankey-node-mark")
      .attr("stroke-opacity", (d) => (activeNodeIds.has(d.nodeId) ? 1 : 0.25))
    svg
      .selectAll(".sankey-node-label")
      .attr("opacity", (d) => (activeNodeIds.has(d.nodeId) ? 1 : 0.6))
      .style("font-weight", (d) => (d.nodeId === nodeId ? 600 : 400));
  }

  function bindNodeHover(selection) {
    selection
      .on("mouseenter", function (event, d) {
        applyHoverState(d.nodeId);
        show(event, tooltipOptionsForNode(d));
      })
      .on("mousemove", function (event, d) {
        if (hoveredNodeId !== d.nodeId) applyHoverState(d.nodeId);
        show(event, tooltipOptionsForNode(d));
      })
      .on("mouseleave", function () {
        applyHoverState(null);
        hide();
      });
  }

  [exhibitionNodes, artistNodes, svg.selectAll(".sankey-node-hit")].forEach(
    bindNodeHover,
  );

  nodeGroup.each(function (d) {
    const g = d3.select(this);
    drawNodeLabel(g, d);
  });

  bindNodeHover(nodeGroup.selectAll(".sankey-node-label"));
}

function handleResize() {
  renderChart();
}

let resizeObserver = null;

onMounted(() => {
  renderChart();
  window.addEventListener("resize", handleResize);
  if (typeof ResizeObserver !== "undefined" && containerRef.value) {
    resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.value);
  }
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", handleResize);
  resizeObserver?.disconnect();
  destroyTooltip?.();
  destroyTooltip = null;
});

watch(graphData, renderChart, { deep: true });
</script>

<template>
  <div ref="containerRef" class="exhibitions-sankey"></div>
</template>

<style scoped src="./style.css"></style>
