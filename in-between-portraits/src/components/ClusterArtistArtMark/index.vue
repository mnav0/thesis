<script setup>
import { ref, watch } from "vue";

const props = defineProps({
  /** Distinct image URLs to try in order (already capped). */
  candidates: {
    type: Array,
    default: () => [],
  },
  /** Bumps when art mode is re-enabled to reset load/retry state. */
  modeEpoch: {
    type: Number,
    default: 0,
  },
});

const attemptIndex = ref(0);
const exhausted = ref(false);
const imageLoaded = ref(false);

function resetState() {
  attemptIndex.value = 0;
  exhausted.value = false;
  imageLoaded.value = false;
}

watch(
  () => [props.modeEpoch, props.candidates],
  () => {
    resetState();
  },
);

function onImgLoad() {
  imageLoaded.value = true;
}

function onImgError() {
  imageLoaded.value = false;
  if (attemptIndex.value < props.candidates.length - 1) {
    attemptIndex.value += 1;
  } else {
    exhausted.value = true;
  }
}
</script>

<template>
  <div class="cs-point-mark cs-point-mark--art">
    <img
      v-if="candidates.length && !exhausted"
      :key="`${modeEpoch}-${attemptIndex}-${candidates[attemptIndex]}`"
      :src="candidates[attemptIndex]"
      class="cs-point-mark__img"
      :class="{ 'cs-point-mark__img--loaded': imageLoaded }"
      alt=""
      @load="onImgLoad"
      @error="onImgError"
    />
    <span
      v-else
      class="cs-point-fallback-rect"
      aria-hidden="true"
    />
  </div>
</template>

<style scoped src="./style.css"></style>

<style>
/* Unscoped: react to ancestor .cs-point--* from ClusterSection (no parent :deep). */
/* drop-shadow follows non-transparent pixels — no square halo when aspect ≠ 1. */
.cs-point--active-cluster .cs-point-mark__img--loaded {
  filter: drop-shadow(0 0 0.5px rgba(17, 17, 17, 0.45)),
    drop-shadow(0 0 1px rgba(17, 17, 17, 0.22));
}

.cs-point--active-cluster .cs-point-fallback-rect {
  box-shadow:
    0 0 0 0.5px rgba(17, 17, 17, 0.35),
    0 0 0 1px rgba(17, 17, 17, 0.2);
}

.cs-point--hovered .cs-point-mark__img--loaded {
  filter: drop-shadow(0 0 5px rgba(0, 0, 0, 0.42));
}

.cs-point--hovered .cs-point-fallback-rect {
  box-shadow: 0 0 6px rgba(0, 0, 0, 0.45);
}

.cs-point--dimmed .cs-point-fallback-rect {
  opacity: 0.22;
}
</style>
