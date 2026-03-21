<script setup>
import { defineProps, defineEmits } from "vue";
const props = defineProps({
  cluster: Object,
  groupBy: String,
});
const emit = defineEmits(["close"]);
</script>

<template>
  <div class="cluster-view-fullpage">
    <button class="close-btn" @click="emit('close')">×</button>
    <h2 class="cluster-view-heading">{{ cluster.name }}</h2>
    <div class="cluster-view-artworks">
      <div
        v-for="art in cluster.items"
        :key="art.title + art.image_url"
        class="cluster-view-art"
      >
        <img
          v-if="art.image_url && art.image_url.trim() !== ''"
          :src="art.image_url"
          :alt="art.title"
          class="cluster-view-img"
        />
        <div v-else class="cluster-view-placeholder"></div>
        <div class="cluster-view-meta">
          <div class="cluster-view-title">
            {{ art.title
            }}<span v-if="art.date_created">, {{ art.date_created }}</span>
          </div>
          <div class="cluster-view-label">
            <template v-if="groupBy === 'artist'">
              {{ art.institutionName }}
            </template>
            <template v-else>
              {{ art.artistName }}
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cluster-view-fullpage {
  position: fixed;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.97);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-width: 100vw;
  padding: 0;
  margin: 0;
  overflow-y: auto;
  box-sizing: border-box;
}
.close-btn {
  position: absolute;
  right: 2vw;
  top: 2vw;
  font-size: 2.5em;
  background: none;
  border: none;
  cursor: pointer;
  color: #222;
  font-family: "Instrument Serif", serif;
  z-index: 10;
}
.cluster-view-heading {
  font-family: "Instrument Serif", serif;
  font-size: 3em;
  margin: 2vw 0 2vw 0;
  text-align: center;
}
.cluster-view-artworks {
  display: flex;
  flex-wrap: wrap;
  gap: 2vw;
  justify-content: center;
  align-items: flex-start;
  width: 100vw;
  margin: 0 auto;
}
.cluster-view-art {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 260px;
  margin-bottom: 1.2em;
}
.cluster-view-img {
  max-width: 220px;
  max-height: 220px;
  width: auto;
  height: auto;
  border-radius: 0;
  box-shadow: 0 2px 12px #0002;
  background: #eee;
  margin-bottom: 0.7em;
}
.cluster-view-placeholder {
  width: 220px;
  height: 220px;
  border: 2px solid #111;
  background: none;
  border-radius: 0;
  margin-bottom: 0.7em;
}
.cluster-view-meta {
  text-align: center;
}
.cluster-view-title {
  font-size: 1.2em;
  font-weight: bold;
  margin-bottom: 0.2em;
  font-family: "Instrument Serif", serif;
}
.cluster-view-label {
  font-size: 1em;
  color: #444;
  font-family: "Kosugi", sans-serif;
}
</style>
