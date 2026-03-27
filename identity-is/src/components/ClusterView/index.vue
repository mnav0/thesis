<script setup>
import { computed } from "vue";
import DotTimeline from "../DotTimeline/index.vue";
import {
  artistsById,
  institutionsById,
  artworks as allArtworks,
  artistThemeRows,
  institutionThemeRows,
} from "../../data/index.js";
import { COLOR_MAP } from "../../constants.js";

const props = defineProps({
  cluster: Object,
  groupBy: String,
});

const emit = defineEmits(["close"]);

const dotTimelineData = computed(() => {
  if (props.groupBy !== "theme" || !props.cluster) return [];
  const themeTitle = props.cluster.name;

  const artistData = artistThemeRows
    .filter((row) => row.theme_title === themeTitle)
    .map((row) => ({
      artist: row.artist,
      artistName: artistsById.value[row.artist]?.name || row.artist,
      date: row.date,
      theme_source_sentence: row.theme_source_sentence,
      is_artwork: row.theme_source && row.theme_source.startsWith("W"),
      sourceType: "artist",
      sourceName: artistsById.value[row.artist]?.name || row.artist,
    }));

  const institutionData = institutionThemeRows
    .filter((row) => row.theme_title === themeTitle)
    .map((row) => ({
      artist: row.artist,
      artistName: artistsById.value[row.artist]?.name || row.artist,
      date: row.date,
      theme_source_sentence: row.theme_source_sentence,
      sourceType: "institution",
      sourceName:
        institutionsById.value[row.institution]?.name || row.institution,
    }));

  return [...artistData, ...institutionData].sort(
    (a, b) => +a.date - +b.date,
  );
});

const dotTimelineArtworks = computed(() => {
  if (props.groupBy !== "theme" || !props.cluster) return [];
  const artistIds = new Set(props.cluster.items.map((art) => art.artist));
  return allArtworks.value
    .filter(
      (art) =>
        artistIds.has(art.artist) &&
        art.date_created &&
        art.artistName &&
        art.image_url,
    )
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
        :width="1100"
        :height="550"
        :colorMap="COLOR_MAP"
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

<style scoped src="./style.css"></style>
