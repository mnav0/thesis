<script setup>
import { computed, ref, watch } from "vue";
import DotTimeline from "../DotTimeline/index.vue";
import ArtistGallery from "../ArtistGallery/index.vue";
import {
  artistsById,
  institutionsById,
  artworks as allArtworks,
  artistThemeRows,
  institutionThemeRows,
  featuredQuotesByArtistId,
} from "../../data/index.js";
import { COLOR_MAP } from "../../constants.js";

const props = defineProps({
  cluster: Object,
  groupBy: String,
});

const emit = defineEmits(["close"]);

/** When false, single-artist gallery hero is still in view — modal header matches hero (#111). */
const galleryPastHero = ref(true);

/** Same artist-id lookup as ArtistGallery’s featured-quote wiring (CSV map only). */
function hasFeaturedQuoteUuid(ids) {
  if (!ids?.length) return false;
  const aid = String(ids[0]);
  return Boolean(
    featuredQuotesByArtistId.get(aid) ||
      featuredQuotesByArtistId.get(String(Number(aid) - 1)),
  );
}

const showArtistGallery = computed(
  () => (props.cluster?.items?.length || 0) === 1,
);
const showDotTimeline = computed(
  () =>
    props.groupBy === "theme" ||
    (props.groupBy === "embedding" && !showArtistGallery.value),
);

/** Theme CSV uses string artist ids; cluster items may be number — normalize for Set.has */
function timelineIdSet(cluster) {
  if (!cluster?.items?.length) return new Set();
  return new Set(
    cluster.items
      .map((art) =>
        art.artist == null || art.artist === "" ? null : String(art.artist),
      )
      .filter(Boolean),
  );
}

const timelineArtistIds = computed(() => timelineIdSet(props.cluster));

/**
 * Artist ids fed to <ArtistGallery>. Currently only the single-artist branch
 * is wired up, but the prop is an array so the gallery can later aggregate
 * a cluster's artists without changing its shape.
 */
const galleryArtistIds = computed(() => {
  if (!showArtistGallery.value) return [];
  const first = props.cluster?.items?.[0]?.artist;
  return first == null ? [] : [String(first)];
});

watch(
  () => [showArtistGallery.value, galleryArtistIds.value],
  ([show, ids]) => {
    if (!show || !ids.length) {
      galleryPastHero.value = true;
      return;
    }
    galleryPastHero.value = !hasFeaturedQuoteUuid(ids);
  },
  { immediate: true },
);

const dotTimelineData = computed(() => {
  if (!showDotTimeline.value || !props.cluster) return [];

  let filterArtist;
  let filterTheme;
  if (props.groupBy === "embedding") {
    filterArtist = timelineArtistIds.value;
  } else {
    filterTheme = props.cluster.name;
  }

  const artistData = artistThemeRows
    .filter((row) =>
      filterTheme
        ? row.theme_title === filterTheme
        : filterArtist.has(String(row.artist)),
    )
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
    .filter((row) =>
      filterTheme
        ? row.theme_title === filterTheme
        : filterArtist.has(String(row.artist)),
    )
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
  if (!showDotTimeline.value || !props.cluster) return [];
  return allArtworks.value
    .filter(
      (art) =>
        timelineArtistIds.value.has(String(art.artist)) &&
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
  <div
    class="cluster-view-fullpage"
    :class="{ 'cluster-view-fullpage--gallery': showArtistGallery }"
  >
    <header
      class="cluster-view-header"
      :class="{
        'cluster-view-header--on-hero':
          showArtistGallery &&
          galleryArtistIds.length > 0 &&
          !galleryPastHero,
      }"
    >
      <h2 class="cluster-view-heading">{{ cluster.name }}</h2>
      <button
        type="button"
        class="close-btn"
        aria-label="Close"
        @click="emit('close')"
      >
        ×
      </button>
    </header>
    <ArtistGallery
      v-if="showArtistGallery && galleryArtistIds.length"
      :artist-ids="galleryArtistIds"
      @past-hero-change="galleryPastHero = $event"
    />
    <div
      v-else-if="showArtistGallery"
      class="cluster-view-empty"
    >No artist data found for this view.</div>
    <div v-else-if="showDotTimeline">
      <div v-if="dotTimelineData.length === 0 && dotTimelineArtworks.length === 0" class="cluster-view-empty">
        No theme or artwork data found for this artist.
      </div>
      <DotTimeline
        v-else
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
