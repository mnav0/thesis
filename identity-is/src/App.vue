<script setup>
import { ref, onMounted } from "vue";
import { fetchAndParseData, groupBy, groupedArtworks } from "./data/index.js";
import ClusterGrid from "./components/ClusterGrid/index.vue";
import ClusterView from "./components/ClusterView/index.vue";

const expandedCluster = ref(null);

onMounted(fetchAndParseData);
</script>

<template>
  <div class="page">
    <label>
      Cluster by:
      <select v-model="groupBy">
        <option value="theme">Theme</option>
        <option value="artist">Artist</option>
        <option value="institution">Institution</option>
        <option value="medium">Medium</option>
      </select>
    </label>

    <section class="cluster-section">
      <ClusterGrid
        :groups="groupedArtworks"
        @select="expandedCluster = $event"
      />
    </section>

    <ClusterView
      v-if="expandedCluster"
      :cluster="expandedCluster"
      :groupBy="groupBy"
      @close="expandedCluster = null"
    />
  </div>
</template>

<style scoped src="./App.css"></style>
