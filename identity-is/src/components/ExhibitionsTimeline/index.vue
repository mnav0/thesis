<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import * as d3 from "d3";
import { createTooltip } from "../../utils/d3/tooltip.js";
import { exhibitionTooltipShowOptions } from "../../utils/exhibition-tooltip.js";
import {
  EXHIBITIONS_LINK_STROKE_PX,
  EXHIBITIONS_NODE_RX_PX,
  EXHIBITIONS_NODE_SIZE_PX,
  EXHIBITIONS_VIZ_MARGIN,
  EXHIBITIONS_VIZ_MAX_WIDTH_PX,
} from "../../constants/exhibitions-viz.js";
import { FONT_SANS } from "../../constants.js";
import exhibitionsCSV from "../../data/exhibitions.csv?raw";

const LABEL_FONT_PX = 13;

function parseArtistIds(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(String(raw).replace(/'/g, '"'));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function exhibitionStartYear(dateStart) {
  if (!dateStart) return null;
  const parts = String(dateStart).split("/");
  const year = Number(parts[parts.length - 1]);
  return Number.isFinite(year) ? String(year) : null;
}

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
        artistCount: artistIds.length,
      };
    })
    .filter((e) => Number.isFinite(e.yearNum));
});

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

const containerRef = ref(null);
let resizeObserver = null;

function renderChart() {
  const root = containerRef.value;
  if (!root) return;
  d3.select(root).selectAll("*").remove();

  const items = exhibitions.value;
  if (!items.length) return;

  const margin = EXHIBITIONS_VIZ_MARGIN;
  const width = root.clientWidth || 900;
  const size = EXHIBITIONS_NODE_SIZE_PX;
  const height = Math.max(48, size + 40);
  const innerLeft = margin.left;
  const innerRight = width - margin.right;
  const cy = height / 2;

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

  const { show, hide } = createTooltip(root);

  const lineX1 = xScale(domainLo);
  const lineX2 = xScale(domainHi);

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
    .attr("dominant-baseline", "middle")
    .attr("fill", "#fff")
    .style("font-family", FONT_SANS)
    .style("font-size", `${LABEL_FONT_PX}px`)
    .text(String(lo));

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

  svg
    .selectAll("rect.exhibition-marker")
    .data(laidOut)
    .enter()
    .append("rect")
    .attr("class", "exhibition-marker")
    .attr("x", (d) => xScale(d.yearNum) + d.xOffset - size / 2)
    .attr("y", cy - size / 2)
    .attr("width", size)
    .attr("height", size)
    .attr("rx", rx)
    .attr("fill", "#fff")
    .attr("stroke", "#fff")
    .attr("stroke-width", 1)
    .style("cursor", "pointer")
    .on("mouseover", function (event, d) {
      d3.select(this).attr("fill", "#eee").attr("stroke-width", 2);
      show(event, exhibitionTooltipShowOptions(d, d.artistCount));
    })
    .on("mouseout", function () {
      d3.select(this).attr("fill", "#fff").attr("stroke-width", 1);
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
});

watch(exhibitions, renderChart, { deep: true });
</script>

<template>
  <div
    ref="containerRef"
    class="exhibitions-timeline"
    :style="{ maxWidth: `${EXHIBITIONS_VIZ_MAX_WIDTH_PX}px` }"
  ></div>
</template>

<style scoped src="./style.css"></style>
