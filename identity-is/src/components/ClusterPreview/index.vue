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

  return themes.map((theme, index) => {
    // Fill the full container height with deterministic, organic placement.
    const seed = hashString(`${theme}-${index}`);
    const jitterX = ((seed & 0xff) / 255 - 0.5) * 16;
    const jitterY = (((seed >> 8) & 0xff) / 255 - 0.5) * 7;

    const radius = Math.sqrt((index + 0.5) / total) * 46;
    const angle = index * 2.39996322973; // golden angle in radians
    const baseX = 50 + Math.cos(angle) * radius;
    const baseY = ((index + 0.5) / total) * 100;

    const x = Math.min(98, Math.max(2, baseX + jitterX));
    const y = Math.min(98, Math.max(2, baseY + jitterY));

    return {
      theme,
      style: {
        left: `${x}%`,
        top: `${y}%`,
      },
    };
  });
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
