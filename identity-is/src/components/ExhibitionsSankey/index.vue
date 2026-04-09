<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import * as d3 from "d3";
import { sankey as d3Sankey, sankeyLinkHorizontal, sankeyLeft } from "d3-sankey";
import { createTooltip } from "../../utils/d3/tooltip.js";
import {
  escapeHtml,
  exhibitionTooltipShowOptions,
} from "../../utils/exhibition-tooltip.js";
import {
  EXHIBITIONS_LINK_STROKE_PX,
  EXHIBITIONS_NODE_SIZE_PX,
  EXHIBITIONS_VIZ_MARGIN,
  EXHIBITIONS_VIZ_MAX_WIDTH_PX,
} from "../../constants/exhibitions-viz.js";
import { FONT_SANS } from "../../constants.js";
import exhibitionsCSV from "../../data/exhibitions.csv?raw";
import artistsCSV from "../../data/artists.csv?raw";

const NODE_WIDTH = EXHIBITIONS_NODE_SIZE_PX;
const NODE_PADDING = 32;
const LABEL_FONT_PX = 13;
const LINK_STROKE = EXHIBITIONS_LINK_STROKE_PX;
const BASE_REQUIRED_HEIGHT = 600;

const containerRef = ref(null);

const artistsById = computed(() => {
  const rows = d3.csvParse(artistsCSV);
  const map = {};
  rows.forEach((r) => (map[r.id] = r));
  return map;
});

function parseArtistIds(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(String(raw).replace(/'/g, '"'));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

/** Tooltip only: birth/death line, or null if no birth year. */
function artistLifeLine(row) {
  if (!row) return null;
  const by = String(row.birth_year ?? "").trim();
  const dy = String(row.death_year ?? "").trim();
  if (!by) return null;
  if (dy) return `(${by} - ${dy})`;
  return `(${by} - )`;
}

function exhibitionStartYear(dateStart) {
  if (!dateStart) return null;
  const parts = String(dateStart).split("/");
  const year = Number(parts[parts.length - 1]);
  return Number.isFinite(year) ? String(year) : null;
}

/** Longest line width */
const EXHIBITION_LINE_MAX_CHARS = 28;

/** Greedy word wrap; used as fallback and for long segments. */
function wrapGreedyWords(trimmed, max) {
  const words = trimmed.split(/\s+/);
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

/**
 * Two lines at a word boundary closest to the string midpoint (both lines <= max).
 */
function wrapBalancedNearMiddle(trimmed, max) {
  const words = trimmed.split(/\s+/);
  if (words.length <= 1) return wrapGreedyWords(trimmed, max);

  const L = trimmed.length;
  let bestK = -1;
  let bestScore = Infinity;

  for (let k = 1; k < words.length; k++) {
    const line1 = words.slice(0, k).join(" ");
    const line2 = words.slice(k).join(" ");
    if (line1.length > max || line2.length > max) continue;
    const score =
      Math.abs(line1.length - L / 2) + 0.01 * Math.abs(line1.length - line2.length);
    if (score < bestScore) {
      bestScore = score;
      bestK = k;
    }
  }

  if (bestK !== -1) {
    return [words.slice(0, bestK).join(" "), words.slice(bestK).join(" ")];
  }
  return wrapGreedyWords(trimmed, max);
}

/**
 * Split on ":" or ", " only when the separator sits near the string midpoint and
 * both sides are substantial — avoids "Short:" + long remainder (e.g. Legacies:, Dis/orient:).
 */
function trySplitAtCenterPunctuation(trimmed, max) {
  const L = trimmed.length;
  const mid = L / 2;
  if (Math.abs(mid - max) > max * 0.5) return null;
  if (L <= max) return null;

  const minSeg = 10;
  /** Separators must sit this close to the string midpoint (not just "early" title: subtitle). */
  const window = max * 0.5;

  let best = null;
  let bestScore = Infinity;

  for (let i = 0; i < L; i++) {
    const ch = trimmed[i];
    if (ch === ",") {
      if (i + 1 >= L || trimmed[i + 1] !== " ") continue;
    } else if (ch !== ":") {
      continue;
    }

    let splitEnd = i + 1;
    while (splitEnd < L && trimmed[splitEnd] === " ") splitEnd++;

    const line1 = trimmed.slice(0, splitEnd).trimEnd();
    const line2 = trimmed.slice(splitEnd).trimStart();
    if (!line2) continue;
    if (line1.length < minSeg || line2.length < minSeg) continue;

    const dist = Math.abs(i - mid);
    if (dist > window) continue;

    const score =
      dist + 0.02 * Math.abs(line1.length - line2.length);
    if (score < bestScore) {
      bestScore = score;
      best = { line1, line2 };
    }
  }

  return best;
}

/**
 * Avoid a lone short word on the final line (e.g. "Art") by merging onto the
 * previous line or moving one word from the previous line down.
 */
function fixWidowLastLine(lines, max) {
  if (lines.length < 2) return lines;

  const WIDOW_WORD_MAX = 5;

  const last = lines[lines.length - 1].trim();
  const prev = lines[lines.length - 2].trim();
  const lastWords = last.split(/\s+/).filter(Boolean);
  if (lastWords.length !== 1) return lines;

  const orphan = lastWords[0];
  if (orphan.length > WIDOW_WORD_MAX) return lines;

  const merged = `${prev} ${orphan}`;
  if (merged.length <= max) {
    return [...lines.slice(0, -2), merged];
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
  const L = trimmed.length;

  if (L <= max) return [trimmed];

  const punct = trySplitAtCenterPunctuation(trimmed, max);
  if (punct) {
    const { line1, line2 } = punct;
    const out = [];
    out.push(
      ...(line1.length <= max ? [line1] : wrapGreedyWords(line1, max)),
    );
    out.push(
      ...(line2.length <= max ? [line2] : wrapGreedyWords(line2, max)),
    );
    return fixWidowLastLine(out, max);
  }

  if (L <= max * 2.6) {
    return fixWidowLastLine(wrapBalancedNearMiddle(trimmed, max), max);
  }

  return fixWidowLastLine(wrapGreedyWords(trimmed, max), max);
}

const graphData = computed(() => {
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
      type: "exhibition",
    })),
    ...[...artistIdSet].map((id) => {
      const row = artistsById.value[id];
      const fallback = `Artist ${id}`;
      return {
        nodeId: `ar-${id}`,
        name: row?.name || fallback,
        lifeLine: artistLifeLine(row),
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
  d3.select(root).selectAll("*").remove();

  const { nodes, links } = graphData.value;
  if (!nodes.length) return;

  const width = root.clientWidth || 900;
  const baseHeight = root.clientHeight || BASE_REQUIRED_HEIGHT;
  const margin = EXHIBITIONS_VIZ_MARGIN;
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

  const svg = d3
    .select(root)
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  const { show, hide } = createTooltip(root);

  svg
    .append("g")
    .selectAll("path")
    .data(graph.links)
    .enter()
    .append("path")
    .attr("d", sankeyLinkHorizontal())
    .attr("fill", "none")
    .attr("stroke", "#fff")
    .attr("stroke-width", LINK_STROKE)
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
    return d.type === "exhibition" ? "#eee" : "#111";
  }

  nodeGroup
    .append("rect")
    .attr("x", (d) => d.x0)
    .attr("y", (d) => d.y0)
    .attr("height", (d) => Math.max(1, d.y1 - d.y0))
    .attr("width", (d) => d.x1 - d.x0)
    .attr("fill", nodeFill)
    .attr("stroke", "#fff")
    .attr("stroke-width", 1)
    .attr("rx", 1)
    .style("cursor", "pointer")
    .on("mouseover", function (event, d) {
      d3.select(this).attr("fill", nodeFillHover(d)).attr("stroke-width", 2);
      if (d.type === "exhibition") {
        show(event, exhibitionTooltipShowOptions(d));
      } else {
        const life = d.lifeLine ? `<div style="margin-top:2px">${escapeHtml(d.lifeLine)}</div>` : "";
        show(event, {
          bg: "#000",
          fg: "#fff",
          border: "#fff",
          html: `<div><strong>${escapeHtml(d.name)}</strong></div>${life}`,
        });
      }
    })
    .on("mouseout", function (event, d) {
      d3.select(this).attr("fill", nodeFill(d)).attr("stroke-width", 1);
      hide();
    });

  nodeGroup.each(function (d) {
    const g = d3.select(this);
    const cx = (d.y0 + d.y1) / 2;
    const labelX =
      d.type === "exhibition" ? d.x0 - 8 : d.x1 + 8;
    const anchor = d.type === "exhibition" ? "end" : "start";
    const lineDyEm = 1.1;

    if (d.type === "exhibition") {
      const text = g
        .append("text")
        .attr("x", labelX)
        .attr("y", cx)
        .attr("text-anchor", anchor)
        .attr("fill", "#fff")
        .style("font-family", FONT_SANS)
        .style("font-size", `${LABEL_FONT_PX}px`);

      const lines = wrapExhibitionTitle(d.name);
      if (lines.length === 1) {
        text.attr("dy", "0.35em").text(lines[0]);
      } else {
        text
          .append("tspan")
          .attr("x", labelX)
          .attr("dy", `${-((lines.length - 1) * lineDyEm) / 4}em`)
          .text(lines[0]);
        for (let i = 1; i < lines.length; i++) {
          text
            .append("tspan")
            .attr("x", labelX)
            .attr("dy", `${lineDyEm}em`)
            .text(lines[i]);
        }
      }
    } else {
      g.append("text")
        .attr("x", labelX)
        .attr("y", cx)
        .attr("text-anchor", anchor)
        .attr("fill", "#fff")
        .style("font-family", FONT_SANS)
        .style("font-size", `${LABEL_FONT_PX}px`)
        .attr("dy", "0.35em")
        .text(d.name);
    }
  });
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
});

watch(graphData, renderChart, { deep: true });
</script>

<template>
  <div
    ref="containerRef"
    class="exhibitions-sankey"
    :style="{ maxWidth: `${EXHIBITIONS_VIZ_MAX_WIDTH_PX}px` }"
  ></div>
</template>

<style scoped src="./style.css"></style>
