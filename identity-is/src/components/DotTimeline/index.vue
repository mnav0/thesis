<script setup>
import { onMounted, ref, watch } from "vue";
import * as d3 from "d3";
import { parseYear } from "../../utils/parse-year.js";
import { computeClusterOffset } from "../../utils/cluster-offsets.js";
import { createTooltip } from "../../utils/d3/tooltip.js";
import {
  COLOR_MAP,
  THEME_SIZE,
  ARTWORK_SIZE,
  ARTWORK_HOVER_SCALE,
  TIMELINE_MARGIN,
  YEAR_PADDING,
  FONT_SANS,
} from "../../constants.js";

const props = defineProps({
  data: Array,
  artworks: Array,
  width: { type: Number, default: 1300 },
  height: { type: Number, default: 1080 },
  colorMap: {
    type: Object,
    default: () => ({ ...COLOR_MAP }),
  },
});

const chartRef = ref(null);

function render() {
  const el = chartRef.value;
  if (!el) return;
  d3.select(el).selectAll("*").remove();

  const margin = TIMELINE_MARGIN;
  let width = props.width;
  if (!width || width === 0) {
    width = el.parentElement
      ? el.parentElement.offsetWidth
      : window.innerWidth;
  }
  const height = props.height;
  const colorMap = props.colorMap;

  const yValues = Array.from(
    new Set([
      ...props.data.map((d) => d.artistName),
      ...props.artworks.map((a) => a.artistName),
    ]),
  );
  const y = d3
    .scaleBand()
    .domain(yValues)
    .range([margin.top, height - margin.bottom])
    .padding(0.2);

  const allYears = [
    ...props.data.map((d) => parseYear(d.date)),
    ...props.artworks.map((a) => parseYear(a.date)),
  ].filter(Boolean);
  const minYear = d3.min(allYears) - YEAR_PADDING;
  const maxYear = d3.max(allYears) + YEAR_PADDING;
  const x = d3
    .scaleLinear()
    .domain([minYear, maxYear])
    .range([margin.left, width - margin.right]);

  const svg = d3
    .select(el)
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`)
    .style("width", "100vw");

  // Y axis
  svg
    .append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).tickSize(0))
    .selectAll("text")
    .attr("transform", "translate(-10,0)")
    .style("font-family", FONT_SANS)
    .style("font-size", "1.7em")
    .style("text-transform", "uppercase");

  // X axis
  svg
    .append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(6).tickFormat(d3.format("d")))
    .selectAll("text")
    .style("font-family", FONT_SANS);

  // Shared tooltip
  const { show: showTooltip, hide: hideTooltip } = createTooltip(el);

  // --- Theme statement dots ---
  const filteredThemeData = props.data.filter((d) => !d.is_artwork);
  const themeGroups = d3.groups(
    filteredThemeData,
    (d) => d.artistName,
    (d) => parseYear(d.date),
  );

  const themeRects = [];
  themeGroups.forEach(([artistName, byYear]) => {
    byYear.forEach(([yearRaw, points]) => {
      const year =
        typeof yearRaw === "number" ? yearRaw : parseYear(yearRaw);
      const n = points.length;
      const centerX = x(year) + 5;
      const centerY = y(artistName) + y.bandwidth() / 2;
      const radius = Math.max(8, Math.min(18, 8 + n * 2));

      for (let i = 0; i < n; i++) {
        const { dx, dy } = computeClusterOffset(i, n, radius);
        themeRects.push({
          ...points[i],
          _x: centerX - THEME_SIZE / 2 + dx,
          _y: centerY - THEME_SIZE / 2 + dy,
        });
      }
    });
  });

  svg
    .selectAll(".theme-dot")
    .data(themeRects)
    .enter()
    .append("rect")
    .attr("class", "theme-dot")
    .attr("x", (d) => d._x)
    .attr("y", (d) => d._y)
    .attr("width", THEME_SIZE)
    .attr("height", THEME_SIZE)
    .attr("fill", (d) => colorMap[d.sourceType] || "#ccc")
    .attr("stroke", (d) =>
      d.sourceType === "artist" ? "#fff" : "#111",
    )
    .attr("stroke-width", 1)
    .on("mouseover", function (event, d) {
      d3.select(this).attr("stroke-width", 2);
      const isArtist = d.sourceType === "artist";
      const bg = isArtist ? "#111" : "#fff";
      const fg = isArtist ? "#fff" : "#111";
      const border = isArtist ? "#fff" : "#111";
      showTooltip(event, {
        bg,
        fg,
        border,
        html:
          `<div style='padding-bottom: 0.7em;'>${d.theme_source_sentence}</div>` +
          `<div style='border-top: 1px solid ${border}; margin-top: 0.7em; padding-top: 0.5em; font-size: 0.98em; color: ${fg}; text-align: right;'>${d.sourceName} (${d.date})</div>`,
      });
    })
    .on("mouseout", function () {
      d3.select(this).attr("stroke-width", 1);
      hideTooltip();
    });

  // --- Artwork dots ---
  const artworkGroups = d3.groups(
    props.artworks,
    (d) => d.artistName,
    (d) => parseYear(d.date),
  );
  const artworkRects = [];

  let imagesLoaded = 0;
  let totalImages = props.artworks.filter((a) => a.image_url).length;
  const imageDims = {};

  props.artworks.forEach((a) => {
    if (!a.image_url) return;
    const img = new window.Image();
    img.onload = function () {
      imageDims[a.image_url] = { w: img.naturalWidth, h: img.naturalHeight };
      imagesLoaded++;
      if (imagesLoaded === totalImages) drawArtworks();
    };
    img.onerror = function () {
      imageDims[a.image_url] = { w: ARTWORK_SIZE, h: ARTWORK_SIZE };
      imagesLoaded++;
      if (imagesLoaded === totalImages) drawArtworks();
    };
    img.src = a.image_url;
  });

  function drawArtworks() {
    artworkGroups.forEach(([artistName, byYear]) => {
      byYear.forEach(([yearRaw, artworksInGroup]) => {
        const year =
          typeof yearRaw === "number" ? yearRaw : parseYear(yearRaw);
        const n = artworksInGroup.length;
        const centerX = x(year);
        const centerY = y(artistName) + y.bandwidth() / 2;
        const radius = Math.max(8, Math.min(18, 8 + n * 2));

        for (let i = 0; i < n; i++) {
          const d = artworksInGroup[i];
          const dims = imageDims[d.image_url] || {
            w: ARTWORK_SIZE,
            h: ARTWORK_SIZE,
          };
          const scale = Math.min(
            ARTWORK_SIZE / dims.w,
            ARTWORK_SIZE / dims.h,
            1,
          );
          const w = dims.w * scale;
          const h = dims.h * scale;
          const { dx, dy } = computeClusterOffset(i, n, radius);

          artworkRects.push({
            ...d,
            _w: w,
            _h: h,
            _x: centerX - w / 2 + dx,
            _y: centerY - h / 2 + dy,
          });
        }
      });
    });

    svg
      .append("g")
      .selectAll(".artwork-dot")
      .data(artworkRects)
      .enter()
      .append("image")
      .attr("class", "artwork-dot")
      .attr("x", (d) => d._x)
      .attr("y", (d) => d._y)
      .attr("width", (d) => d._w)
      .attr("height", (d) => d._h)
      .attr("href", (d) => d.image_url)
      .attr("preserveAspectRatio", "xMidYMid slice")
      .style("cursor", "pointer")
      .on("mouseover", function (event, d) {
        d3.select(this)
          .transition()
          .duration(120)
          .attr("width", d._w * ARTWORK_HOVER_SCALE)
          .attr("height", d._h * ARTWORK_HOVER_SCALE)
          .attr("x", d._x - (d._w * (ARTWORK_HOVER_SCALE - 1)) / 2)
          .attr("y", d._y - (d._h * (ARTWORK_HOVER_SCALE - 1)) / 2);
        showTooltip(event, {
          bg: "#111",
          fg: "#fff",
          border: "#fff",
          html:
            `<div style='padding-bottom: 0.7em;'><b>${d.title}</b></div>` +
            `<div style='border-top: 1px solid #fff; margin-top: 0.7em; padding-top: 0.5em; font-size: 0.98em; color: #fff; text-align: right;'>${d.artistName} (${d.date})</div>`,
        });
      })
      .on("mouseout", function (event, d) {
        d3.select(this)
          .transition()
          .duration(120)
          .attr("width", d._w)
          .attr("height", d._h)
          .attr("x", d._x)
          .attr("y", d._y);
        hideTooltip();
      });
  }

  if (totalImages === 0) drawArtworks();
}

onMounted(render);
watch(() => [props.data, props.artworks], render, { deep: true });
</script>

<template>
  <div ref="chartRef" class="dot-timeline-root"></div>
</template>

<style scoped src="./style.css"></style>
