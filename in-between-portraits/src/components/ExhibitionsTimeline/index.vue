<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import * as d3 from "d3";
import { createTooltip } from "../../utils/d3/tooltip.js";
import { exhibitionTooltipShowOptions } from "../../utils/exhibition-tooltip.js";
import { EXHIBITION_ERA, getExhibitionEraById } from "../../utils/exhibition-era.js";
import { exhibitionStartYear, parseArtistIds } from "../../utils/exhibition-data.js";
import {
  exhibitionMarkHeightPx,
  EXHIBITIONS_LINK_STROKE_PX,
  EXHIBITIONS_NODE_RX_PX,
  EXHIBITIONS_NODE_SIZE_PX,
  EXHIBITIONS_VIZ_MARGIN,
} from "../../constants/exhibitions-viz.js";
import { FONT_SANS } from "../../constants.js";
import exhibitionsCSV from "../../data/exhibitions.csv?raw";

const LABEL_FONT_PX = 16;
const LANE_LABEL_FONT_PX = 16;
const LANE_LINE_GAP_PX = 60;
const TOP_BOTTOM_PADDING_PX = 24;

const exhibitions = computed(() => {
  const rows = d3.csvParse(exhibitionsCSV);
  return rows
    .map((r) => {
      const startYear = exhibitionStartYear(r.date_start);
      const yearNum = startYear != null ? Number(startYear) : NaN;
      const artistIds = parseArtistIds(r.artists);
      return {
        id: r.id,
        name: r.name || "Untitled Exhibition",
        location: r.location || "",
        startYear,
        yearNum,
        artistIds,
        artistCount: artistIds.length,
        era: getExhibitionEraById(r.id),
      };
    })
    .filter((e) => Number.isFinite(e.yearNum));
});

const markerHeightByExhibitionId = computed(() =>
  Object.fromEntries(exhibitions.value.map((e) => [e.id, exhibitionMarkHeightPx(e.artistCount)])),
);

function layoutTimelineNodes(list) {
  const byYear = d3.group(list, (d) => d.yearNum);
  const out = [];
  for (const [, group] of byYear) {
    const n = group.length;
    group.forEach((e, i) => {
      const step = EXHIBITIONS_NODE_SIZE_PX + 2;
      const xOffset = n === 1 ? 0 : (i - (n - 1) / 2) * step;
      out.push({ ...e, xOffset });
    });
  }
  return out;
}

function markerYForEra(cy, markerHeight, era) {
  if (era === EXHIBITION_ERA.CONTEMPORARY) return cy - markerHeight;
  if (era === EXHIBITION_ERA.MODERN) return cy;
  return cy - markerHeight / 2;
}

const containerRef = ref(null);
let resizeObserver = null;
let destroyTooltip = null;

function renderChart() {
  const root = containerRef.value;
  if (!root) return;
  destroyTooltip?.();
  destroyTooltip = null;
  d3.select(root).selectAll("*").remove();

  const items = exhibitions.value;
  if (!items.length) return;

  const margin = EXHIBITIONS_VIZ_MARGIN;
  const width = root.clientWidth || 900;
  const size = EXHIBITIONS_NODE_SIZE_PX;
  const maxMarkerHeight = d3.max(items, (d) => markerHeightByExhibitionId.value[d.id] ?? size) ?? size;
  const minHeightForLaneGuides = LANE_LINE_GAP_PX * 2 + 72;
  const height = Math.max(
    minHeightForLaneGuides,
    maxMarkerHeight * 2 + TOP_BOTTOM_PADDING_PX * 2,
  );
  const innerLeft = margin.left;
  const innerRight = width - margin.right;
  const cy = height / 2;
  const laneOffset = Math.max(LANE_LINE_GAP_PX, size + 4);

  const yearNums = items.map((d) => d.yearNum);
  const lo = d3.min(yearNums);
  const hi = d3.max(yearNums);
  /** Centers of min/max year markers align with Sankey extent edges (no line overhang). */
  const domainLo = lo === hi ? lo - 0.5 : lo;
  const domainHi = lo === hi ? hi + 0.5 : hi;
  const xScale = d3
    .scaleLinear()
    .domain([domainLo, domainHi])
    .range([innerLeft + size / 2, innerRight - size / 2]);

  const laidOut = layoutTimelineNodes(items);

  const svg = d3
    .select(root)
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  const { show, hide, destroy } = createTooltip(root);
  destroyTooltip = destroy;

  const lineX1 = xScale(domainLo);
  const lineX2 = xScale(domainHi);

  svg
    .append("line")
    .attr("x1", lineX1)
    .attr("x2", lineX2)
    .attr("y1", cy - laneOffset)
    .attr("y2", cy - laneOffset)
    .attr("stroke", "#fff")
    .attr("stroke-opacity", 0.7)
    .attr("stroke-width", EXHIBITIONS_LINK_STROKE_PX)
    .attr("stroke-dasharray", "2.5 3");

  svg
    .append("line")
    .attr("x1", lineX1)
    .attr("x2", lineX2)
    .attr("y1", cy + laneOffset)
    .attr("y2", cy + laneOffset)
    .attr("stroke", "#fff")
    .attr("stroke-opacity", 0.7)
    .attr("stroke-width", EXHIBITIONS_LINK_STROKE_PX)
    .attr("stroke-dasharray", "2.5 3");

  svg
    .append("line")
    .attr("x1", lineX1)
    .attr("x2", lineX2)
    .attr("y1", cy)
    .attr("y2", cy)
    .attr("stroke", "#fff")
    .attr("stroke-width", EXHIBITIONS_LINK_STROKE_PX);

  svg
    .append("text")
    .attr("x", innerLeft - 10)
    .attr("y", cy)
    .attr("text-anchor", "end")
    .attr("dominant-baseline", "central")
    .attr("fill", "#fff")
    .style("font-family", FONT_SANS)
    .style("font-size", `${LABEL_FONT_PX}px`)
    .text(String(lo));

  svg
    .append("text")
    .attr("x", innerLeft - 10)
    .attr("y", cy - laneOffset)
    .attr("text-anchor", "end")
    .attr("dominant-baseline", "middle")
    .attr("fill", "#fff")
    .attr("fill-opacity", 0.75)
    .style("font-family", FONT_SANS)
    .style("font-size", `${LANE_LABEL_FONT_PX}px`)
    .text("CONTEMPORARY");

  svg
    .append("text")
    .attr("x", innerLeft - 10)
    .attr("y", cy + laneOffset)
    .attr("text-anchor", "end")
    .attr("dominant-baseline", "middle")
    .attr("fill", "#fff")
    .attr("fill-opacity", 0.75)
    .style("font-family", FONT_SANS)
    .style("font-size", `${LANE_LABEL_FONT_PX}px`)
    .text("MODERN");

  svg
    .append("text")
    .attr("x", innerRight + 10)
    .attr("y", cy)
    .attr("text-anchor", "start")
    .attr("dominant-baseline", "middle")
    .attr("fill", "#fff")
    .style("font-family", FONT_SANS)
    .style("font-size", `${LABEL_FONT_PX}px`)
    .text(String(hi));

  const rx = EXHIBITIONS_NODE_RX_PX;

  const markers = svg
    .selectAll("rect.exhibition-marker")
    .data(laidOut)
    .enter()
    .append("rect")
    .attr("class", "exhibition-marker")
    .attr("data-exhibition-id", (d) => d.id)
    .attr("data-era", (d) => d.era)
    .attr("x", (d) => xScale(d.yearNum) + d.xOffset - size / 2)
    .attr("y", (d) => markerYForEra(cy, markerHeightByExhibitionId.value[d.id] ?? size, d.era))
    .attr("width", size)
    .attr("height", (d) => markerHeightByExhibitionId.value[d.id] ?? size)
    .attr("rx", rx)
    .attr("fill", "#fff")
    .attr("stroke", "#fff")
    .attr("stroke-width", 1)
    .style("cursor", "pointer");
  markers.each(function (d) {
    d._markerEl = this;
  });

  // Wider invisible targets help recover hover on narrow timeline bars.
  const hitWidth = Math.max(size, 14);
  const hitOffset = (hitWidth - size) / 2;
  const markerHits = svg
    .selectAll("rect.exhibition-marker-hit")
    .data(laidOut)
    .enter()
    .append("rect")
    .attr("class", "exhibition-marker-hit")
    .attr("data-exhibition-id", (d) => d.id)
    .attr("data-era", (d) => d.era)
    .attr("x", (d) => xScale(d.yearNum) + d.xOffset - size / 2 - hitOffset)
    .attr("y", (d) => markerYForEra(cy, markerHeightByExhibitionId.value[d.id] ?? size, d.era))
    .attr("width", hitWidth)
    .attr("height", (d) => markerHeightByExhibitionId.value[d.id] ?? size)
    .attr("fill", "transparent")
    .style("cursor", "pointer");

  markers
    .on("mouseenter", function (event, d) {
      d3.select(this).attr("stroke-width", 2);
      show(event, exhibitionTooltipShowOptions(d));
    })
    .on("mousemove", function (event, d) {
      show(event, exhibitionTooltipShowOptions(d));
    })
    .on("mouseleave", function () {
      d3.select(this).attr("stroke-width", 1);
      hide();
    });

  markerHits
    .on("mouseenter", function (event, d) {
      d3.select(d._markerEl).attr("stroke-width", 2);
      show(event, exhibitionTooltipShowOptions(d));
    })
    .on("mousemove", function (event, d) {
      show(event, exhibitionTooltipShowOptions(d));
    })
    .on("mouseleave", function (event, d) {
      d3.select(d._markerEl).attr("stroke-width", 1);
      hide();
    });
}

function handleResize() {
  renderChart();
}

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

watch(exhibitions, renderChart, { deep: true });
</script>

<template>
  <div ref="containerRef" class="exhibitions-timeline"></div>
</template>

<style scoped src="./style.css"></style>
