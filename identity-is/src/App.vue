<script setup>
import { onBeforeUnmount, onMounted, ref } from "vue";
import { groupBy, groupedArtworks } from "./data/index.js";
import ClusterGrid from "./components/ClusterGrid/index.vue";
import ClusterView from "./components/ClusterView/index.vue";
import PageSection from "./components/PageSection/index.vue";
import ClusterPreview from "./components/ClusterPreview/index.vue";
import ActorsPreview from "./components/ActorsPreview/index.vue";
import ExhibitionsGraph from "./components/ExhibitionsGraph/index.vue";
import { publicImgSrc } from "./utils/public-img-src.js";

const expandedCluster = ref(null);

const personaSectionIllustrationSrc = publicImgSrc("persona.svg");

const firstSectionTone = ref("dark");
const firstSectionHeading = ref("Identity is");
const shellReady = ref(false);

let firstSectionSwapTimeout = null;

onMounted(() => {
  const fontWait =
    typeof document !== "undefined" && document.fonts?.ready
      ? document.fonts.ready
      : Promise.resolve();
  Promise.race([fontWait, new Promise((r) => setTimeout(r, 500))]).then(() => {
    shellReady.value = true;
  });

  firstSectionSwapTimeout = window.setTimeout(() => {
    firstSectionTone.value = "light";
    firstSectionHeading.value =
      "Identity is<br/><i>not defined</i><br/><i>by one label</i><br/><i>or field.</i>";
  }, 3000);
});

onBeforeUnmount(() => {
  if (firstSectionSwapTimeout) window.clearTimeout(firstSectionSwapTimeout);
});
</script>

<template>
  <main class="app-shell w-full" :class="{ 'app-shell--ready': shellReady }">
    <PageSection :tone="firstSectionTone" layout="split" :heading="firstSectionHeading">
      <ClusterPreview />
    </PageSection>

    <PageSection
      tone="light"
      layout="stacked"
      texture-preset="rightSoft"
      heading="Making art provides a way to <i>process</i>, <i>define</i>, and <i>express</i> complex identities."
    >
      <ActorsPreview />
    </PageSection>

    <PageSection tone="light" layout="split" texture-preset="leftDual">
      <div
        class="grid h-full grid-cols-12 content-between gap-x-2 gap-y-8 md:grid-rows-[auto_1fr_auto] md:gap-x-4"
      >
        <h2 class="col-span-12 m-0 md:col-span-5">
          What makes up a persona*?
        </h2>
        <div class="hidden md:block md:col-span-2" aria-hidden="true"></div>
        <div class="col-span-12 flex justify-center md:col-span-5 md:justify-end">
          <img
            :src="personaSectionIllustrationSrc"
            alt=""
            class="w-full max-w-[28rem]"
            role="presentation"
          />
        </div>
        <p class="col-span-12 mt-8 md:row-start-3 md:self-end">
          *A representation of artist identity constructed from texts that
          contextualize their work.
        </p>
      </div>
    </PageSection>

    <PageSection
      tone="dark"
      layout="stacked"
      texture-preset="rightDual"
      stacked-body-gap="relaxed"
      heading="What makes up a persona?"
      subheading="...for modern and contemporary artists selected from <u>exhibitions</u> curated surrounding the experience of mixed-race and Asian-American identity."
    >
      <ExhibitionsGraph />
    </PageSection>

    <PageSection tone="light" layout="stacked" texture-preset="mixed" stacked-full-width>
      <div class="grid grid-cols-12 gap-x-2 gap-y-4 md:gap-x-4">
        <div class="col-span-12">
          <label>
            Cluster by:
            <select v-model="groupBy" class="ml-2 border border-black bg-white px-2 py-1">
              <option value="theme">Theme</option>
              <option value="artist">Artist</option>
              <option value="institution">Institution</option>
              <option value="medium">Medium</option>
            </select>
          </label>
        </div>
        <div class="col-span-12">
          <ClusterGrid
            :groups="groupedArtworks"
            @select="expandedCluster = $event"
          />
        </div>
      </div>
    </PageSection>

    <ClusterView
      v-if="expandedCluster"
      :cluster="expandedCluster"
      :groupBy="groupBy"
      @close="expandedCluster = null"
    />
  </main>
</template>
