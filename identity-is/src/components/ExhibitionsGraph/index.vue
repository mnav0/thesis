<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import * as d3 from "d3";
import { createTooltip } from "../../utils/d3/tooltip.js";
import { FONT_SANS } from "../../constants.js";
import exhibitionsCSV from "../../data/exhibitions.csv?raw";

const AXIS_TICK_PX = 14;
const AXIS_TICK_PADDING_PX = 6;

const graphRef = ref(null);
const exhibitionRows = d3.csvParse(exhibitionsCSV);

function getArtistsCount(rawArtists) {
  if (!rawArtists) return 0;
  try {
    const parsed = JSON.parse(String(rawArtists).replace(/'/g, '"'));
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

function getStartYear(dateStart) {
  if (!dateStart) return null;
  const parts = String(dateStart).split("/");
  const year = Number(parts[parts.length - 1]);
  return Number.isFinite(year) ? year : null;
}

const graphData = computed(() =>
  exhibitionRows
    .map((row) => ({
      id: row.id,
      name: row.name || "Untitled Exhibition",
      location: row.location || "Unknown Location",
      artistCount: getArtistsCount(row.artists),
      year: getStartYear(row.date_start),
    }))
    .filter((row) => row.year !== null)
    .sort((a, b) => a.year - b.year),
);

function renderGraph() {
  const root = graphRef.value;
  if (!root) return;
  d3.select(root).selectAll("*").remove();
  if (!graphData.value.length) return;

  const width = root.clientWidth || 560;
  const height = root.clientHeight || 400;
  const margin = { top: 20, right: 18, bottom: 90, left: 128 };

  const minYear = d3.min(graphData.value, (d) => d.year);
  const maxYear = d3.max(graphData.value, (d) => d.year);
  const maxArtists = d3.max(graphData.value, (d) => d.artistCount) || 1;

  const x = d3
    .scaleLinear()
    .domain([minYear - 1, maxYear + 1])
    .range([margin.left, width - margin.right]);

  const y = d3
    .scaleLinear()
    .domain([0, maxArtists + 1])
    .nice()
    .range([height - margin.bottom, margin.top]);

  const svg = d3
    .select(root)
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  svg
    .append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(
      d3
        .axisBottom(x)
        .ticks(5)
        .tickFormat(d3.format("d"))
        .tickPadding(AXIS_TICK_PADDING_PX),
    )
    .call((g) => g.select(".domain").attr("stroke", "#fff"))
    .call((g) => g.selectAll("line").attr("stroke", "#fff"))
    .call((g) =>
      g
        .selectAll("text")
        .style("fill", "#fff")
        .style("font-family", FONT_SANS)
        .style("font-size", `${AXIS_TICK_PX}px`),
    );

  svg
    .append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(
      d3
        .axisLeft(y)
        .ticks(4)
        .tickFormat(d3.format("d"))
        .tickPadding(AXIS_TICK_PADDING_PX),
    )
    .call((g) => g.select(".domain").attr("stroke", "#fff"))
    .call((g) => g.selectAll("line").attr("stroke", "#fff"))
    .call((g) =>
      g
        .selectAll("text")
        .style("fill", "#fff")
        .style("font-family", FONT_SANS)
        .style("font-size", `${AXIS_TICK_PX}px`),
    );

  const yAxisLabel = svg
    .append("text")
    .attr("transform", `translate(${margin.left - 50}, ${margin.top + 34})`)
    .attr("text-anchor", "end")
    .style("fill", "#fff")
    .style("font-family", FONT_SANS)
    .style("font-size", `${AXIS_TICK_PX}px`);

  yAxisLabel
    .append("tspan")
    .attr("x", 0)
    .attr("dy", "-0.55em")
    .text("Number of");

  yAxisLabel.append("tspan").attr("x", 0).attr("dy", "1.15em").text("artists");

  const xAxisLabelGapPx = 14;
  const xAxisLabelX = width - margin.right;
  const xAxisLabel = svg
    .append("text")
    .attr("x", xAxisLabelX)
    .attr("y", height - xAxisLabelGapPx)
    .attr("text-anchor", "end")
    .style("fill", "#fff")
    .style("font-family", FONT_SANS)
    .style("font-size", `${AXIS_TICK_PX}px`);

  xAxisLabel
    .append("tspan")
    .attr("x", xAxisLabelX)
    .attr("dy", "-0.55em")
    .text("Exhibition");

  xAxisLabel.append("tspan").attr("x", xAxisLabelX).attr("dy", "1.15em").text("year");

  const line = d3
    .line()
    .x((d) => x(d.year))
    .y((d) => y(d.artistCount));

  svg
    .append("path")
    .datum(graphData.value)
    .attr("fill", "none")
    .attr("stroke", "#fff")
    .attr("stroke-width", 1.5)
    .attr("d", line);

  const { show, hide } = createTooltip(root);

  svg
    .append("g")
    .selectAll("circle")
    .data(graphData.value)
    .enter()
    .append("circle")
    .attr("cx", (d) => x(d.year))
    .attr("cy", (d) => y(d.artistCount))
    .attr("r", 10)
    .attr("fill", "#000")
    .attr("stroke", "#fff")
    .attr("stroke-width", 1.5)
    .style("cursor", "pointer")
    .on("mouseover", function (event, d) {
      d3.select(this).attr("r", 12).attr("stroke-width", 2);
      show(event, {
        bg: "#fff",
        fg: "#111",
        border: "#111",
        html: `<div><strong>${d.name}</strong></div><div>${d.location}</div>`,
      });
    })
    .on("mouseout", function () {
      d3.select(this).attr("r", 10).attr("stroke-width", 1.5);
      hide();
    });
}

function handleResize() {
  renderGraph();
}

let resizeObserver = null;

onMounted(() => {
  renderGraph();
  window.addEventListener("resize", handleResize);
  if (typeof ResizeObserver !== "undefined" && graphRef.value) {
    resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(graphRef.value);
  }
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", handleResize);
  resizeObserver?.disconnect();
});

watch(graphData, renderGraph, { deep: true });
</script>

<template>
  <div ref="graphRef" class="exhibitions-graph"></div>
</template>

<style scoped src="./style.css"></style>
