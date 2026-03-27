<script setup>
const actors = [
  { key: "artist", 
    label: "Artist", 
    icon: "/artist.svg", 
    top: "10%", 
    left: "0%" 
  },
  { key: "persona", 
    label: "Persona", 
    icon: "/persona.svg", 
    top: "80%", 
    left: "20%" 
  },
  { key: "artwork", 
    label: "Artwork", 
    icon: "/artwork.svg", 
    top: "20%", 
    left: "50%" 
  },
  {
    key: "institution",
    label: "Institution",
    icon: "/institution.svg",
    top: "60%",
    left: "70%",
  },
];
</script>

<template>
  <div class="actors-preview">
    <div
      v-for="actor in actors"
      :key="actor.key"
      class="actors-preview__cell"
      :style="{ top: actor.top, left: actor.left }"
    >
      <img
        :src="actor.icon"
        :alt="`${actor.label} icon`"
        class="actors-preview__icon"
      />
      <span class="uppercase">{{ actor.label }}</span>
    </div>
  </div>
</template>

<style scoped src="./style.css"></style>
