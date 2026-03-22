<script setup>
import { ref, onMounted } from "vue";
import {
  artistsById,
  institutionsById,
  artworks,
  groupBy,
  fetchAndParseData,
  groupedArtworks,
  getClusterStyle,
  computeClusterRadius,
} from "./main.js";
import ClusterView from "./ClusterView.vue";
import "./style.css";
const expandedCluster = ref(null);
function openCluster(cluster) {
  expandedCluster.value = cluster;
}
function closeCluster() {
  expandedCluster.value = null;
}
onMounted(fetchAndParseData);
</script>

<template>
  <div style="max-width: 1600px; margin: 0 auto">
    <label>
      Cluster by:
      <select v-model="groupBy">
        <option value="artist">Artist</option>
        <option value="institution">Institution</option>
        <option value="medium">Medium</option>
        <option value="theme">Theme</option>
      </select>
    </label>
    <div class="clusters-grid">
      <div
        v-for="group in groupedArtworks"
        :key="group.name"
        class="cluster-outer"
      >
        <div
          class="cluster-container"
          @click="openCluster(group)"
          :style="{
            cursor: 'pointer',
            width:
              Math.max(computeClusterRadius(group.items.length) * 2, 100) +
              'px',
            height:
              Math.max(computeClusterRadius(group.items.length) * 2, 100) +
              'px',
          }"
        >
          <div class="cluster-center-label">{{ group.name }}</div>
          <div
            v-for="(art, idx) in group.items"
            :key="art.title + art.image_url"
            class="cluster-art"
            :style="
              getClusterStyle(
                idx,
                group.items.length,
                Math.max(computeClusterRadius(group.items.length) * 2, 100),
              )
            "
          >
            <template v-if="art.image_url && art.image_url.trim() !== ''">
              <img :src="art.image_url" :alt="art.title" class="cluster-img" />
            </template>
            <template v-else>
              <div class="cluster-placeholder"></div>
            </template>
            <div class="cluster-title" style="display: none">
              {{ art.title }}
            </div>
          </div>
        </div>
      </div>
    </div>
    <ClusterView
      v-if="expandedCluster"
      :cluster="expandedCluster"
      :groupBy="groupBy"
      @close="closeCluster"
    />
  </div>
</template>
