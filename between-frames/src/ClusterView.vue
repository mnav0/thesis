<script setup>
import { defineProps, defineEmits, computed } from "vue";
import DotTimeline from "./DotTimeline.vue";
import { artistsById, institutionsById } from "./main.js";
import artistThemesCSV from "./data/artist_themes.csv?raw";
import institutionThemesCSV from "./data/institution_themes.csv?raw";

const props = defineProps({
  cluster: Object,
  groupBy: String,
});
const emit = defineEmits(["close"]);

// Parse CSV utility (copied from main.js)
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0]
    .split(",")
    .map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const values = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') inQuotes = !inQuotes;
      else if (char === "," && !inQuotes) {
        values.push(current);
        current = "";
      } else current += char;
    }
    values.push(current);
    const cleanedValues = values.map((v) => v.trim().replace(/^"|"$/g, ""));
    const obj = {};
    headers.forEach((h, i) => (obj[h] = cleanedValues[i]));
    return obj;
  });
}

const artistThemeRows = parseCSV(artistThemesCSV);
const institutionThemeRows = parseCSV(institutionThemesCSV);

const dotTimelineData = computed(() => {
  if (props.groupBy !== "theme" || !props.cluster) return [];
  const themeTitle = props.cluster.name;
  // Get all theme rows for this theme from both sources
  const artistRows = artistThemeRows.filter(
    (row) => row.theme_title === themeTitle,
  );
  const institutionRows = institutionThemeRows.filter(
    (row) => row.theme_title === themeTitle,
  );
  // Map to chart data format
  const artistData = artistRows.map((row) => ({
    artist: row.artist,
    artistName: artistsById.value[row.artist]?.name || row.artist,
    date: row.date,
    theme_source_sentence: row.theme_source_sentence,
    sourceType: "artist",
    sourceName: artistsById.value[row.artist]?.name || row.artist,
  }));
  const institutionData = institutionRows.map((row) => ({
    artist: row.artist,
    artistName: artistsById.value[row.artist]?.name || row.artist,
    date: row.date,
    theme_source_sentence: row.theme_source_sentence,
    sourceType: "institution",
    sourceName:
      institutionsById.value[row.institution]?.name || row.institution,
  }));
  // Merge and sort by date
  return [...artistData, ...institutionData].sort((a, b) => +a.date - +b.date);
});

const dotTimelineArtworks = computed(() => {
  if (props.groupBy !== "theme" || !props.cluster) return [];
  // For each artist, show ALL artworks (not just one per artist/date)
  return props.cluster.items
    .filter((art) => art.date_created && art.artistName && art.image_url)
    .map((art) => ({
      artist: art.artist,
      artistName: art.artistName,
      date: art.date_created,
      title: art.title,
      image_url: art.image_url,
    }));
});
</script>

<template>
  <div class="cluster-view-fullpage">
    <button class="close-btn" @click="emit('close')">×</button>
    <h2 class="cluster-view-heading">{{ cluster.name }}</h2>
    <div v-if="groupBy === 'theme'">
      <DotTimeline
        :data="dotTimelineData"
        :artworks="dotTimelineArtworks"
        :width="900"
        :height="420"
        :colorMap="{ artist: '#111', institution: '#fff' }"
      />
    </div>
    <div v-else class="cluster-view-artworks">
      <div
        v-for="art in cluster.items"
        :key="art.title + art.image_url"
        class="cluster-view-art"
      >
        <img
          v-if="art.image_url && art.image_url.trim() !== ''"
          :src="art.image_url"
          :alt="art.title"
          class="cluster-view-img"
        />
        <div v-else class="cluster-view-placeholder"></div>
        <div class="cluster-view-meta">
          <div class="cluster-view-title">
            {{ art.title
            }}<span v-if="art.date_created">, {{ art.date_created }}</span>
          </div>
          <div class="cluster-view-label">
            <template v-if="groupBy === 'artist'">
              {{ art.institutionName }}
            </template>
            <template v-else>
              {{ art.artistName }}
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cluster-view-fullpage {
  position: fixed;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.97);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-width: 100vw;
  padding: 0;
  margin: 0;
  overflow-y: auto;
  box-sizing: border-box;
}
.close-btn {
  position: absolute;
  right: 2vw;
  top: 2vw;
  font-size: 2.5em;
  background: none;
  border: none;
  cursor: pointer;
  color: #222;
  font-family: "Instrument Serif", serif;
  z-index: 10;
}
.cluster-view-heading {
  font-family: "Instrument Serif", serif;
  font-size: 3em;
  margin: 2vw 0 2vw 0;
  text-align: center;
}
.cluster-view-artworks {
  display: flex;
  flex-wrap: wrap;
  gap: 2vw;
  justify-content: center;
  align-items: flex-start;
  width: 100vw;
  margin: 0 auto;
}
.cluster-view-art {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 260px;
  margin-bottom: 1.2em;
}
.cluster-view-img {
  max-width: 220px;
  max-height: 220px;
  width: auto;
  height: auto;
  border-radius: 0;
  box-shadow: 0 2px 12px #0002;
  background: #eee;
  margin-bottom: 0.7em;
}
.cluster-view-placeholder {
  width: 220px;
  height: 220px;
}
.cluster-view-meta {
  text-align: center;
}
.cluster-view-title {
  font-size: 1.2em;
  font-weight: bold;
  margin-bottom: 0.2em;
  font-family: "Instrument Serif", serif;
}
.cluster-view-label {
  font-size: 1em;
  color: #444;
  font-family: "Kosugi", sans-serif;
}
</style>
