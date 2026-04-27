<script setup>
import { computed } from "vue";
import { getArtistDotData } from "../../utils/artist-dot.js";

const props = defineProps({
  artistId: { type: [String, Number], required: true },
});

const dot = computed(() => getArtistDotData(props.artistId));
</script>

<template>
  <svg
    v-if="dot"
    class="artist-dot"
    :viewBox="dot.viewBox"
    preserveAspectRatio="xMidYMid meet"
    aria-hidden="true"
    focusable="false"
  >
    <path :d="dot.d" vector-effect="non-scaling-stroke" />
  </svg>
</template>

<style scoped>
.artist-dot {
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
</style>
