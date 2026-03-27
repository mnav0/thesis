<script setup>
import {
  computeClusterRadius,
  getClusterStyle,
} from "../../utils/cluster-layout.js";

defineProps({
  groups: Array,
});

const emit = defineEmits(["select"]);

function containerSize(group) {
  return Math.max(computeClusterRadius(group.items.length) * 2, 100);
}
</script>

<template>
  <div class="clusters-grid">
    <div
      v-for="group in groups"
      :key="group.name"
      class="cluster-outer"
    >
      <div
        class="cluster-container"
        @click="emit('select', group)"
        :style="{
          width: containerSize(group) + 'px',
          height: containerSize(group) + 'px',
        }"
      >
        <div class="cluster-center-label">{{ group.name }}</div>
        <div
          v-for="(art, idx) in group.items"
          :key="art.title + art.image_url"
          class="cluster-art"
          :style="getClusterStyle(idx, group.items.length, containerSize(group))"
        >
          <img
            v-if="art.image_url && art.image_url.trim() !== ''"
            :src="art.image_url"
            :alt="art.title"
            class="cluster-img"
          />
          <div v-else class="cluster-placeholder"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped src="./style.css"></style>
