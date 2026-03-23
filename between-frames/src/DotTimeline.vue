<script setup>
import { onMounted, ref, watch } from "vue";
import * as d3 from "d3";

const props = defineProps({
  data: Array, // [{ artist, artistName, institution, institutionName, date, theme_source_sentence, theme_source, sourceType, sourceName, artworkTitle, artworkImageUrl, artworkYear }]
  artworks: Array, // [{ artist, artistName, date, title, image_url }]
  width: { type: Number, default: 1300 }, // 0 means fill parent
  height: { type: Number, default: 1080 },
  colorMap: {
    type: Object,
    default: () => ({ artist: "#111", institution: "#fff" }),
  },
});

const chartRef = ref(null);

function render() {
  const el = chartRef.value;
  if (!el) return;
  d3.select(el).selectAll("*").remove();

  const margin = { top: 40, right: 40, bottom: 100, left: 120 };
  // Responsive width: fill parent if width is 0
  let width = props.width;
  if (!width || width === 0) {
    width = el.parentElement ? el.parentElement.offsetWidth : window.innerWidth;
  }
  const height = props.height;
  const colorMap = props.colorMap;

  // Group by artist
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

  // Helper to parse year from date string (handles 'c. 1951 - 1952' as 1951)
  function parseYear(dateStr) {
    if (!dateStr) return NaN;
    // Remove 'c.' or 'ca.' and trim
    let s = dateStr.replace(/c\.?|ca\.?/i, "").trim();
    // Take first 4-digit number
    const match = s.match(/(\d{4})/);
    if (match) return +match[1];
    return NaN;
  }
  const dataYears = props.data.map((d) => parseYear(d.date)).filter(Boolean);
  const artworkYears = props.artworks
    .map((a) => parseYear(a.date))
    .filter(Boolean);
  const allYears = [...dataYears, ...artworkYears];
  const minYear = d3.min(allYears) - 5;
  const maxYear = d3.max(allYears) + 5;
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
    .attr("transform", `translate(-10,0)`)
    .style("font-family", "Kosugi, sans-serif")
    .style("font-size", "1.7em")
    .style("text-transform", "uppercase");

  // X axis
  svg
    .append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(6).tickFormat(d3.format("d")))
    .selectAll("text")
    .style("font-family", "Kosugi, sans-serif");

  // Dots for theme statements (clustered like artworks)
  // Filter out theme statement points based on artwork title since it'll already be displayed
  const filteredThemeData = props.data.filter(d => !d.is_artwork);

  const THEME_SIZE = 60;
  // Group theme points by artist and year
  const themeGroups = d3.groups(
    filteredThemeData,
    (d) => d.artistName,
    (d) => parseYear(d.date),
  );
  const themeRects = [];
  themeGroups.forEach(([artistName, byYear]) => {
    byYear.forEach(([yearRaw, points]) => {
      const year = typeof yearRaw === "number" ? yearRaw : parseYear(yearRaw);
      const n = points.length;
      const centerX = x(year) + 5; // Shift theme dots slightly to the right of artwork dots to avoid exact overlap
      const centerY = y(artistName) + y.bandwidth() / 2;
      const radius = Math.max(8, Math.min(18, 8 + n * 2));
      for (let i = 0; i < n; i++) {
        let angle, r, dx, dy;
        if (n <= 8) {
          angle = (2 * Math.PI * i) / n;
          r = n === 1 ? 0 : radius;
          dx = Math.cos(angle) * r;
          dy = Math.sin(angle) * r;
        } else {
          angle = (2 * Math.PI * i) / n + i * 0.5;
          r = radius * (0.5 + 0.5 * (i / n));
          dx = Math.cos(angle) * r + (Math.random() - 0.5) * 4;
          dy = Math.sin(angle) * r + (Math.random() - 0.5) * 4;
        }
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
    .attr("stroke", d => (d.sourceType === "artist" ? "#fff" : "#111"))
    .attr("stroke-width", 1)
    .on("mouseover", function (event, d) {
      const containerRect = el.getBoundingClientRect();
      const mouseX = event.clientX - containerRect.left;
      const mouseY = event.clientY - containerRect.top;

      d3.select(this).attr("stroke-width", 2);
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
        .style("left", mouseX + 10 + "px")
        .style("top", mouseY + 10 + "px")
    })
    .on("mouseout", function () {
      d3.select(this).attr("stroke-width", 1);
      tooltip.style("display", "none");
    });

  // Dots for artworks
  const ARTWORK_SIZE = 72;
  const ARTWORK_HOVER_SCALE = 1.1;
  const artworkGroups = d3.groups(
    props.artworks,
    (d) => d.artistName,
    (d) => parseYear(d.date),
  );
  const artworkRects = [];
  let imagesLoaded = 0;
  let totalImages = 0;
  // Preload images to get their natural dimensions
  props.artworks.forEach((a) => {
    if (a.image_url) totalImages++;
  });
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
    // For each (artist, year) group, jitter points in a circle or random cluster around the center
    artworkGroups.forEach(([artistName, byYear]) => {
      byYear.forEach(([yearRaw, artworks]) => {
        const year = typeof yearRaw === "number" ? yearRaw : parseYear(yearRaw);
        const n = artworks.length;
        const centerX = x(year);
        const centerY = y(artistName) + y.bandwidth() / 2;
        const radius = Math.max(8, Math.min(18, 8 + n * 2));
        for (let i = 0; i < n; i++) {
          const d = artworks[i];
          const dims = imageDims[d.image_url] || {
            w: ARTWORK_SIZE,
            h: ARTWORK_SIZE,
          };
          let scale = Math.min(ARTWORK_SIZE / dims.w, ARTWORK_SIZE / dims.h, 1);
          let w = dims.w * scale;
          let h = dims.h * scale;
          let angle, r, dx, dy;
          if (n <= 8) {
            angle = (2 * Math.PI * i) / n;
            r = n === 1 ? 0 : radius;
            dx = Math.cos(angle) * r;
            dy = Math.sin(angle) * r;
          } else {
            angle = (2 * Math.PI * i) / n + i * 0.5;
            r = radius * (0.5 + 0.5 * (i / n));
            dx = Math.cos(angle) * r + (Math.random() - 0.5) * 4;
            dy = Math.sin(angle) * r + (Math.random() - 0.5) * 4;
          }
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
    const g = svg.append("g");
    // Draw images only, no border
    g.selectAll(".artwork-dot")
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
        const containerRect = el.getBoundingClientRect();
        const mouseX = event.clientX - containerRect.left;
        const mouseY = event.clientY - containerRect.top;

        d3.select(this)
          .transition()
          .duration(120)
          .attr("width", d._w * ARTWORK_HOVER_SCALE)
          .attr("height", d._h * ARTWORK_HOVER_SCALE)
          .attr("x", d._x - (d._w * (ARTWORK_HOVER_SCALE - 1)) / 2)
          .attr("y", d._y - (d._h * (ARTWORK_HOVER_SCALE - 1)) / 2);
        tooltip
          .style("display", null)
          .style("background", "#111")
          .style("color", "#fff")
          .style("border-color", "#fff")
          .html(
            `<div style='padding-bottom: 0.7em;'><b>${d.title}</b></div>` +
              `<div style='border-top: 1px solid #fff; margin-top: 0.7em; padding-top: 0.5em; font-size: 0.98em; color: #fff; text-align: right;'>${d.artistName} (${d.date})</div>`,
          )
          .style("left", mouseX + 10 + "px")
          .style("top", mouseY + 10 + "px")
      })
      .on("mouseout", function (event, d) {
        d3.select(this)
          .transition()
          .duration(120)
          .attr("width", d._w)
          .attr("height", d._h)
          .attr("x", d._x)
          .attr("y", d._y);
        tooltip.style("display", "none");
      });
  }
  if (totalImages === 0) drawArtworks();

  // No longer need SVG patterns, using <image> directly for artworks

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
    .style("max-width", "300px")
    .style("min-width", "150px");
}

onMounted(render);
watch(() => [props.data, props.artworks], render, { deep: true });
</script>

<template>
  <div ref="chartRef" class="dot-timeline-root"></div>
</template>

<style scoped>
.dot-timeline-root {
  width: 100vw;
  min-height: 600px;
  position: relative;
  overflow-x: auto;
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
.theme-dot {
  cursor: pointer;
  transition: stroke-width 0.1s;
}
.artwork-dot {
  cursor: pointer;
  transition: all 0.15s;
  shape-rendering: crispEdges;
}
</style>
