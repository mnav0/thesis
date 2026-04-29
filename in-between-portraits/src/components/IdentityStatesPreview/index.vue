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

const labelItems = computed(() => {
  const themes = themePreviewTitles.value || [];
  const total = Math.max(themes.length, 1);
  const leftPaddingPct = 6;
  const rightPaddingPct = 16;
  const topBottomPaddingPct = 5;
  const minX = leftPaddingPct;
  const maxX = 100 - rightPaddingPct;
  const minY = topBottomPaddingPct;
  const maxY = 100 - topBottomPaddingPct;
  return themes.map((theme, index) => {
    const seed = hashString(`${theme}-${index}`);
    const jitterX = ((seed & 0xff) / 255 - 0.5) * 20;
    const jitterY = (((seed >> 8) & 0xff) / 255 - 0.5) * 6;
    const radius = Math.sqrt((index + 0.5) / total) * 44;
    const angle = index * 2.39996322973;
    const baseX = 46 + Math.cos(angle) * radius;
    const baseY = ((index + 0.5) / total) * 100;
    return {
      theme,
      themeKey: theme.trim().toLowerCase(),
      left: `${Math.min(maxX, Math.max(minX, baseX + jitterX))}%`,
      top: `${Math.min(maxY, Math.max(minY, baseY + jitterY))}%`,
    };
  });
});
</script>

<template>
  <div class="identity-states-preview">
    <div class="identity-state">
      <span
        v-for="item in labelItems"
        :key="item.theme"
        class="identity-label label-text"
        :data-theme-key="item.themeKey"
        :style="{ left: item.left, top: item.top }"
      >{{ item.theme }}</span>
    </div>
  </div>
</template>

<style scoped src="./style.css"></style>
