<script setup>
import { computed, ref } from "vue";
import { artworks } from "../../data/index.js";
import "./style.css";

const hiddenArtworkIds = ref(new Set());

const collageItems = computed(() =>
  artworks.value
    .filter((artwork) => isValidImageUrl(artwork.image_url))
    .map((artwork) => ({
      id: artwork.id || artwork.title,
      imageUrl: toCollageImageUrl(artwork.image_url),
      dateCreated: artwork.date_created,
      alt:
        artwork.alt_text?.trim() ||
        `${artwork.title || "Artwork"} by ${artwork.artistName || "Unknown artist"}`,
    }))
    .sort((a, b) => {
      const aYear = getSortYear(a.dateCreated);
      const bYear = getSortYear(b.dateCreated);
      if (aYear !== bYear) {
        return aYear - bYear;
      }
      return String(a.id).localeCompare(String(b.id));
    }),
);

const visibleCollageItems = computed(() =>
  collageItems.value.filter((artwork) => !hiddenArtworkIds.value.has(artwork.id)),
);

function isValidImageUrl(value) {
  if (!value) {
    return false;
  }

  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function toCollageImageUrl(value) {
  const trimmed = value?.trim() || "";
  if (!trimmed) {
    return trimmed;
  }

  if (trimmed.includes("ids.si.edu")) {
    return trimmed.replace(/max=\d+/i, "max=150");
  }

  return trimmed;
}

function getSortYear(value) {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }

  const normalized = String(value)
    .replace(/[–—]/g, "-")
    .trim();
  const yearMatch = normalized.match(/-?\d{3,4}/);
  if (!yearMatch) {
    return Number.POSITIVE_INFINITY;
  }

  return Number.parseInt(yearMatch[0], 10);
}

function hideArtwork(id) {
  if (!id || hiddenArtworkIds.value.has(id)) {
    return;
  }
  const nextHiddenArtworkIds = new Set(hiddenArtworkIds.value);
  nextHiddenArtworkIds.add(id);
  hiddenArtworkIds.value = nextHiddenArtworkIds;
}

function handleImageLoad(event, id) {
  const imageEl = event.target;
  if (!imageEl || imageEl.naturalWidth > 0) {
    return;
  }
  hideArtwork(id);
}
</script>

<template>
  <section class="artwork-collage-section" aria-label="Artwork collage">
    <div class="artwork-collage-track">
      <figure
        v-for="artwork in visibleCollageItems"
        :key="`collage-${artwork.id}`"
        class="artwork-collage-tile"
      >
        <img
          :src="artwork.imageUrl"
          :alt="artwork.alt"
          loading="lazy"
          decoding="async"
          class="artwork-collage-image"
          @error="hideArtwork(artwork.id)"
          @load="handleImageLoad($event, artwork.id)"
        />
      </figure>
    </div>
  </section>
</template>
