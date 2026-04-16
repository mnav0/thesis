<script setup>
import { computed } from "vue";
import { themePreviewTitles } from "../../data/index.js";
import { DOT_SIZE_PX } from "../../constants.js";
import { generateDotPositions } from "../../utils/cluster-offsets.js";

const props = defineProps({
  dotCount: { type: Number, default: 15 },
});

const dotSize = `${DOT_SIZE_PX}px`;

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
  return themes.map((theme, index) => {
    const seed = hashString(`${theme}-${index}`);
    const jitterX = ((seed & 0xff) / 255 - 0.5) * 16;
    const jitterY = (((seed >> 8) & 0xff) / 255 - 0.5) * 3;
    const radius = Math.sqrt((index + 0.5) / total) * 46;
    const angle = index * 2.39996322973;
    const baseX = 50 + Math.cos(angle) * radius;
    const baseY = ((index + 0.5) / total) * 100;
    return {
      theme,
      left: `${Math.min(98, Math.max(2, baseX + jitterX))}%`,
      top: `${Math.min(98, Math.max(2, baseY + jitterY))}%`,
    };
  });
});

const pos1  = computed(() => generateDotPositions(props.dotCount, 1, 101));
const pos3  = computed(() => generateDotPositions(props.dotCount, 3, 301));
const pos5  = computed(() => generateDotPositions(props.dotCount, 5, 501));
</script>

<template>
  <div class="identity-states-preview">
    <div class="identity-states-preview__frame identity-states-preview__frame--outer"></div>
    <div class="identity-states-preview__frame identity-states-preview__frame--inner"></div>

    <div class="identity-state identity-state--active" data-state="descriptor1">
      <span
        v-for="(p, i) in pos1"
        :key="`d1-${i}`"
        class="identity-dot"
        :style="{ left: p.left, top: p.top, width: dotSize, height: dotSize }"
      ></span>
    </div>

    <div class="identity-state" data-state="descriptor2">
      <span
        v-for="item in labelItems"
        :key="item.theme"
        class="identity-label uppercase"
        :style="{ left: item.left, top: item.top }"
      >{{ item.theme }}</span>
    </div>

    <div class="identity-state" data-state="descriptor3_1">
      <span
        v-for="(p, i) in pos1"
        :key="`d31-${i}`"
        class="identity-dot"
        :style="{ left: p.left, top: p.top, width: dotSize, height: dotSize }"
      ></span>
    </div>

    <div class="identity-state" data-state="descriptor3_2">
      <span
        v-for="(p, i) in pos3"
        :key="`d32-${i}`"
        class="identity-dot"
        :style="{ left: p.left, top: p.top, width: dotSize, height: dotSize }"
      ></span>
    </div>

    <div class="identity-state" data-state="descriptor3_3">
      <span
        v-for="(p, i) in pos5"
        :key="`d33-${i}`"
        class="identity-dot"
        :style="{ left: p.left, top: p.top, width: dotSize, height: dotSize }"
      ></span>
    </div>
  </div>
</template>

<style scoped src="./style.css"></style>
