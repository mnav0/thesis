<script setup>
import { REPRESENTATIVE_PERSONA_ARTIST_ID } from "../../constants.js";
import { publicImgSrc } from "../../utils/public-img-src.js";
import ArtistDot from "../ArtistDot/index.vue";

const props = defineProps({
  viewMode: {
    type: String,
    required: true,
  },
  showShuffle: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["change-view-mode", "shuffle"]);

const modes = [
  { key: "exhibitions", label: "Exhibition", icon: "exhibition" },
  { key: "artist", label: "Artist", icon: publicImgSrc("artist.svg") },
  { key: "institution", label: "Institution", icon: publicImgSrc("institution.svg") },
];

function isActive(modeKey) {
  return props.viewMode === modeKey;
}

function iconMaskStyle(iconUrl) {
  return {
    maskImage: `url("${iconUrl}")`,
    WebkitMaskImage: `url("${iconUrl}")`,
  };
}
</script>

<template>
  <div class="cluster-heading">
    <div class="cluster-heading__left">
      <div class="cluster-heading__toggle-row">
        <div class="cluster-heading__group-label" aria-label="Group by words of">
          <span class="cluster-heading__group-line">GROUP BY</span>
          <span class="cluster-heading__group-line">WORDS OF</span>
        </div>
        <div class="cluster-heading__toggle" role="tablist" aria-label="Cluster grouping mode">
          <button
            v-for="mode in modes"
            :key="mode.key"
            type="button"
            class="cluster-heading__toggle-btn label-text"
            :class="{ 'cluster-heading__toggle-btn--active': isActive(mode.key) }"
            @click="emit('change-view-mode', mode.key)"
          >
            <span
              v-if="mode.icon === 'exhibition'"
              class="cluster-heading__exhibition-node"
              aria-hidden="true"
            />
            <span
              v-else
              class="cluster-heading__mode-icon"
              :style="iconMaskStyle(mode.icon)"
              aria-hidden="true"
            />
            <span class="cluster-heading__toggle-label">{{ mode.label }}</span>
          </button>
        </div>
        <div v-if="showShuffle" class="cluster-heading__shuffle-cluster">
          <button
            type="button"
            class="cluster-heading__shuffle-btn label-text"
            aria-label="Shuffle to next cluster count"
            @click="emit('shuffle')"
          >
            Shuffle
          </button>
        </div>
      </div>
      <p class="cluster-heading__subtitle">
        Artists are grouped around central themes extracted from these source texts.
      </p>
    </div>

    <div class="cluster-heading__key">
      <div class="cluster-heading__key-row">
        <span class="cluster-heading__key-marker cluster-heading__key-marker--artist">
          <span class="cluster-heading__key-persona-dot">
            <ArtistDot :artist-id="REPRESENTATIVE_PERSONA_ARTIST_ID" />
          </span>
          <span class="cluster-heading__key-initials">WT</span>
        </span>
        <span class="cluster-heading__key-text">
          <span class="cluster-heading__key-equals">=</span>
          <span class="cluster-heading__key-copy">artist + initials</span>
        </span>
      </div>
      <div class="cluster-heading__key-row">
        <span class="cluster-heading__key-marker cluster-heading__key-marker--line-pair">
          <span class="cluster-heading__key-line cluster-heading__key-line--primary" />
          <span class="cluster-heading__key-line cluster-heading__key-line--secondary" />
        </span>
        <span class="cluster-heading__key-text">
          <span class="cluster-heading__key-equals">=</span>
          <span class="cluster-heading__key-copy">primary vs. secondary group</span>
        </span>
      </div>
      <div class="cluster-heading__key-row">
        <span class="cluster-heading__key-marker cluster-heading__key-marker--anchor">
          <span class="cluster-heading__key-box" />
          <span class="cluster-heading__key-anchor-label">LABEL</span>
        </span>
        <span class="cluster-heading__key-text">
          <span class="cluster-heading__key-equals">=</span>
          <span class="cluster-heading__key-copy">group anchor + theme keywords</span>
        </span>
      </div>
      <div class="cluster-heading__key-row">
        <span class="cluster-heading__key-marker cluster-heading__key-marker--line-pair">
          <span class="cluster-heading__key-line cluster-heading__key-line--similarity-strong" />
          <span class="cluster-heading__key-line cluster-heading__key-line--similarity-weak" />
        </span>
        <span class="cluster-heading__key-text">
          <span class="cluster-heading__key-equals">=</span>
          <span class="cluster-heading__key-copy">similarity to group anchor</span>
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped src="./style.css"></style>
