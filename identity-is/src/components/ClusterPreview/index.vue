<script setup>
import { computed } from "vue";
import { themePreviewTitles } from "../../data/index.js";

function hashString(input) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

const scatteredThemes = computed(() => {
  const themes = themePreviewTitles.value || [];
  const total = Math.max(themes.length, 1);

  const items = themes.map((theme, index) => {
    // Fill the full container height with deterministic, organic placement.
    const seed = hashString(`${theme}-${index}`);
    const jitterX = ((seed & 0xff) / 255 - 0.5) * 16;
    // Keep vertical jitter small so adjacent rows (similar base Y) cannot collide.
    const jitterY = (((seed >> 8) & 0xff) / 255 - 0.5) * 3;

    const radius = Math.sqrt((index + 0.5) / total) * 46;
    const angle = index * 2.39996322973; // golden angle in radians
    const baseX = 50 + Math.cos(angle) * radius;
    const baseY = ((index + 0.5) / total) * 100;

    const x = Math.min(98, Math.max(2, baseX + jitterX));
    const y = Math.min(98, Math.max(2, baseY + jitterY));

    return { theme, x, y };
  });

  // Enforce minimum vertical gap between labels (sorted by Y) so long words stay readable.
  const MIN_Y_GAP = 6.5;
  const Y_LO = 3;
  const Y_HI = 97;
  items.sort((a, b) => a.y - b.y);
  for (let i = 1; i < items.length; i += 1) {
    if (items[i].y - items[i - 1].y < MIN_Y_GAP) {
      items[i].y = items[i - 1].y + MIN_Y_GAP;
    }
  }
  const yMin = items[0]?.y ?? Y_LO;
  const yMax = items[items.length - 1]?.y ?? Y_HI;
  const span = yMax - yMin || 1;
  items.forEach((it) => {
    it.y = Y_LO + ((it.y - yMin) / span) * (Y_HI - Y_LO);
  });

  return items.map(({ theme, x, y }) => ({
    theme,
    style: {
      left: `${x}%`,
      top: `${y}%`,
    },
  }));
});
</script>

<template>
  <ul class="cluster-preview">
    <li
      v-for="item in scatteredThemes"
      :key="item.theme"
      class="cluster-preview-item uppercase"
      :style="item.style"
    >
      {{ item.theme }}
    </li>
  </ul>
</template>

<style scoped src="./style.css"></style>
