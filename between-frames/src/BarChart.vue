<script setup>
import { onMounted, ref, watch } from "vue";
import * as d3 from "d3";

const props = defineProps({
  data: Array, // [{ artist, artistName, institution, institutionName, date, theme_source_sentence, theme_source, sourceType, sourceName }]
  width: { type: Number, default: 800 },
  height: { type: Number, default: 400 },
  colorMap: {
    type: Object,
    default: () => ({ artist: "#111", institution: "#fff" }),
  },
  yLabel: { type: String, default: "Artist" },
  xLabel: { type: String, default: "Year" },
});

const chartRef = ref(null);

function render() {
  const el = chartRef.value;
  if (!el) return;
  d3.select(el).selectAll("*").remove();

  const margin = { top: 40, right: 40, bottom: 40, left: 120 };
  const width = props.width;
  const height = props.height;
  const colorMap = props.colorMap;

  // Group by yLabel (artist)
  const yValues = Array.from(new Set(props.data.map((d) => d.artistName)));
  const y = d3
    .scaleBand()
    .domain(yValues)
    .range([margin.top, height - margin.bottom])
    .padding(0.2);

  // X: time scale
  const years = props.data.map((d) => +d.date).filter(Boolean);
  const minYear = d3.min(years);
  const maxYear = d3.max(years);
  const x = d3
    .scaleLinear()
    .domain([minYear, maxYear])
    .range([margin.left, width - margin.right]);

  const svg = d3
    .select(el)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  // Y axis
  svg
    .append("g")
    .attr("transform", `translate(${margin.left - 10},0)`)
    .call(d3.axisLeft(y).tickSize(0))
    .selectAll("text")
    .style("font-family", "Kosugi, sans-serif")
    .style("font-size", "1.1em");

  // X axis
  svg
    .append("g")
    .attr("transform", `translate(0,${height - margin.bottom + 10})`)
    .call(d3.axisBottom(x).ticks(6).tickFormat(d3.format("d")))
    .selectAll("text")
    .style("font-family", "Kosugi, sans-serif");

  // Bars
  svg
    .selectAll(".theme-bar")
    .data(props.data)
    .enter()
    .append("rect")
    .attr("class", "theme-bar")
    .attr("x", (d) => x(+d.date))
    .attr("y", (d) => y(d.artistName))
    .attr("width", 12)
    .attr("height", y.bandwidth())
    .attr("fill", (d) => colorMap[d.sourceType] || "#ccc")
    .attr("stroke", "#111")
    .on("mouseover", function (event, d) {
      d3.select(this).attr("stroke-width", 2);
      // Tooltip color logic
      const isArtist = d.sourceType === "artist";
      const bg = isArtist ? "#111" : "#fff";
      const fg = isArtist ? "#fff" : "#111";
      const border = isArtist ? "#fff" : "#111";
      tooltip
        .style("display", null)
        .style("background", bg)
        .style("color", fg)
        .style("border-color", border)
        .html(
          `<div style='padding-bottom: 0.7em;'>${d.theme_source_sentence}</div>` +
            `<div style='border-top: 1px solid ${border}; margin-top: 0.7em; padding-top: 0.5em; font-size: 0.98em; color: ${fg}; text-align: right;'>${d.sourceName} (${d.date})</div>`,
        )
        .style("left", event.pageX + 10 + "px")
        .style("top", event.pageY - 30 + "px");
    })
    .on("mouseout", function () {
      d3.select(this).attr("stroke-width", 1);
      tooltip.style("display", "none");
    });

  // Tooltip
  const tooltip = d3
    .select(el)
    .append("div")
    .attr("class", "d3-tooltip")
    .style("position", "absolute")
    .style("background", "#fff")
    .style("border", "1px solid #222")
    .style("padding", "8px 12px")
    .style("font-family", "Kosugi, sans-serif")
    .style("font-size", "1em")
    .style("pointer-events", "none")
    .style("display", "none")
    .style("max-width", "220px")
    .style("min-width", "120px");
}

onMounted(render);
watch(() => props.data, render, { deep: true });
</script>

<template>
  <div ref="chartRef" class="bar-chart-root"></div>
</template>

<style scoped>
.bar-chart-root {
  width: 100%;
  min-height: 300px;
  position: relative;
}
.d3-tooltip {
  position: absolute;
  background: #fff;
  border: 1px solid #222;
  padding: 8px 12px;
  font-family: "Kosugi", sans-serif;
  font-size: 1em;
  pointer-events: none;
  z-index: 10000;
  box-shadow: 0 2px 8px #0002;
  max-width: 220px;
  min-width: 120px;
  white-space: pre-line;
  line-height: 1.35;
}
.theme-bar {
  cursor: pointer;
  transition: stroke-width 0.1s;
}
</style>
