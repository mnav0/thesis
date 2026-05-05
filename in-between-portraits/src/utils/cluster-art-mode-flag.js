import { shallowRef } from "vue";

const clusterArtModeActive = shallowRef(false);

export function setClusterArtModeActive(value) {
  clusterArtModeActive.value = Boolean(value);
}

export function isClusterArtModeActive() {
  return clusterArtModeActive.value;
}
