<script setup>
import { computed, ref, watch } from "vue";
import ArtistGallery from "../ArtistGallery/index.vue";
import {
  featuredQuotesByArtistId,
} from "../../data/index.js";

const props = defineProps({
  cluster: Object,
  groupBy: String,
});

const emit = defineEmits(["close"]);

/** When false, gallery hero is still in view — modal header matches hero (#111). */
const galleryPastHero = ref(true);

/** Check whether this cluster/artist will render a hero section. */
function hasFeaturedQuote(ids) {
  if (!ids?.length) return false;
  // Exhibition clusters always show the exhibition-name hero.
  if (props.cluster?.exhibitionHero) return true;
  if (ids.length > 1) {
    return Boolean(props.cluster?.clusterFeaturedQuote);
  }
  const aid = String(ids[0]);
  return Boolean(
    featuredQuotesByArtistId.get(aid) ||
      featuredQuotesByArtistId.get(String(Number(aid) - 1)),
  );
}

/** Show ArtistGallery for any embedding cluster. */
const showArtistGallery = computed(() => props.groupBy === "embedding");

/** All unique artist IDs from the cluster items. */
const galleryArtistIds = computed(() => {
  if (!showArtistGallery.value) return [];
  const seen = new Set();
  const ids = [];
  for (const item of props.cluster?.items ?? []) {
    const id = item.artist == null ? null : String(item.artist);
    if (id == null || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
});

watch(
  () => [showArtistGallery.value, galleryArtistIds.value],
  ([show, ids]) => {
    if (!show || !ids.length) {
      galleryPastHero.value = true;
      return;
    }
    galleryPastHero.value = !hasFeaturedQuote(ids);
  },
  { immediate: true },
);
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
      <div class="cluster-view-keywords">
        <template v-if="cluster.keywords?.length">
          <span
            v-for="kw in cluster.keywords"
            :key="kw"
            class="cluster-view-keyword"
          >{{ kw }}</span>
        </template>
        <h2 v-else class="cluster-view-heading">{{ cluster.name }}</h2>
      </div>
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
      :cluster-featured-quote="cluster.clusterFeaturedQuote"
      :exhibition-hero="cluster.exhibitionHero"
      @past-hero-change="galleryPastHero = $event"
    />
    <div
      v-else-if="showArtistGallery"
      class="cluster-view-empty"
    >No artist data found for this view.</div>
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
