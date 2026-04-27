<script setup>
import { publicImgSrc } from "../../utils/public-img-src.js";
import ArtistDot from "../ArtistDot/index.vue";

defineProps({
  personaArtistId: { type: [String, Number], default: 18 },
});

const actors = [
  {
    key: "artist",
    label: "Artist",
    icon: publicImgSrc("artist.svg"),
    top: "10%",
    left: "0%",
  },
  {
    key: "persona",
    label: "Persona",
    icon: null,
    top: "80%",
    left: "20%",
  },
  {
    key: "artwork",
    label: "Artwork",
    icon: publicImgSrc("artwork.svg"),
    top: "20%",
    left: "50%",
  },
  {
    key: "institution",
    label: "Institution",
    icon: publicImgSrc("institution.svg"),
    top: "60%",
    left: "70%",
  },
];
</script>

<template>
  <div class="actors-preview">
    <div
      v-for="actor in actors"
      :key="actor.key"
      class="actors-preview__cell"
      :data-actor="actor.key"
      :style="{ top: actor.top, left: actor.left }"
    >
      <div v-if="actor.key === 'persona'" class="actors-preview__icon">
        <ArtistDot :artist-id="personaArtistId" />
      </div>
      <img
        v-else
        :src="actor.icon"
        :alt="`${actor.label} icon`"
        class="actors-preview__icon"
      />
      <span class="label-text">{{ actor.label }}</span>
    </div>
  </div>
</template>

<style scoped src="./style.css"></style>
