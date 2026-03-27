<script setup>
import { computed } from "vue";
import { csvParse } from "d3";
import exhibitionsCSV from "../../data/exhibitions.csv?raw";

const exhibitionRows = csvParse(exhibitionsCSV);

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
  if (!dateStart) return "Unknown";
  const parts = String(dateStart).split("/");
  const year = parts[parts.length - 1];
  return year || "Unknown";
}

const exhibitionsPreview = computed(() =>
  exhibitionRows.map((row) => ({
    id: row.id,
    name: row.name,
    artistCount: getArtistsCount(row.artists),
    year: getStartYear(row.date_start),
  })),
);
</script>

<template>
  <div class="exhibitions-preview">
    <h3 class="exhibitions-title">Exhibitions</h3>
    <ul class="exhibitions-list">
      <li
        v-for="row in exhibitionsPreview"
        :key="row.id"
        class="exhibitions-row"
      >
        <span>{{ row.name }}</span>
        <span
          >{{ row.artistCount }}
          {{ row.artistCount === 1 ? "artist" : "artists" }} / {{ row.year }}</span
        >
      </li>
    </ul>
  </div>
</template>

<style scoped src="./style.css"></style>
