<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import {
  artistClustersMap,
  institutionClustersMap,
  artistPositionsMap,
  institutionPositionsMap,
  exhibitionClustersMap,
} from "./data/index.js";
import ClusterSection from "./components/ClusterSection/index.vue";
import ClusterView from "./components/ClusterView/index.vue";
import PageSection from "./components/PageSection/index.vue";
import ClusterPreview from "./components/ClusterPreview/index.vue";
import ActorsPreview from "./components/ActorsPreview/index.vue";
import ExhibitionsSankey from "./components/ExhibitionsSankey/index.vue";
import ExhibitionsTimeline from "./components/ExhibitionsTimeline/index.vue";
import { publicImgSrc } from "./utils/public-img-src.js";
import {
  destroyAppScrollAnimations,
  initAppScrollAnimations,
} from "./utils/scroll-app-animations.js";

const expandedCluster = ref(null);
const expandedClusterGroupBy = ref(null);
const personaSectionIllustrationSrc = publicImgSrc("persona.svg");
const shellReady = ref(false);
const firstSectionTone = ref("dark");

const section1HeadingHtml = [
  '<span class="s1-short">Identity is</span>',
  '<span class="s1-expanded">Identity is<br/><i>not defined</i><br/><i>by one label</i><br/><i>or field.</i></span>',
].join("");

const section1Ref = ref(null);
const section2Ref = ref(null);
const section3Ref = ref(null);
const timelineRef = ref(null);
const sankeyRef = ref(null);
const exhibitionsLabelRef = ref(null);
const exhibitionsAnchorStartRef = ref(null);
const exhibitionsAnchorEndRef = ref(null);
const section3PersonaRef = ref(null);
const floatingPersonaRef = ref(null);

let smoother = null;

function openClusterFromEmbedding(cluster) {
  expandedCluster.value = cluster;
  expandedClusterGroupBy.value = "embedding";
}

function closeClusterView() {
  expandedCluster.value = null;
  expandedClusterGroupBy.value = null;
}

function getSectionEl(compRef) {
  return compRef.value?.sectionEl ?? compRef.value?.$el;
}

onMounted(() => {
  const fontWait =
    typeof document !== "undefined" && document.fonts?.ready
      ? document.fonts.ready
      : Promise.resolve();
  Promise.race([fontWait, new Promise((r) => setTimeout(r, 500))]).then(() => {
    shellReady.value = true;
    nextTick(() => {
      requestAnimationFrame(() => {
        smoother = initAppScrollAnimations({
          section1El: getSectionEl(section1Ref),
          section2El: getSectionEl(section2Ref),
          section3El: getSectionEl(section3Ref),
          sectionAfterS3El: getSectionEl(timelineRef),
          floatingPersonaEl: floatingPersonaRef.value,
          section3PersonaImg: section3PersonaRef.value,
          onFirstSectionToneChange: (tone) => {
            firstSectionTone.value = tone;
          },
          exhibitionsLabelEl: exhibitionsLabelRef.value,
          exhibitionsAnchorStartEl: exhibitionsAnchorStartRef.value,
          exhibitionsAnchorEndEl: exhibitionsAnchorEndRef.value,
          sankeySectionEl: getSectionEl(sankeyRef),
        });
      });
    });
  });
});

onBeforeUnmount(() => {
  destroyAppScrollAnimations(smoother);
});
</script>

<template>
  <div id="smooth-wrapper">
    <div id="smooth-content">
      <main class="app-shell w-full" :class="{ 'app-shell--ready': shellReady }">
        <!-- Section 1 ─ Identity intro -->
        <PageSection
          ref="section1Ref"
          :tone="firstSectionTone"
          layout="split"
          :heading-html="section1HeadingHtml"
        >
          <ClusterPreview />
        </PageSection>

        <!-- Section 2 ─ Actors (pinned for persona growth) -->
        <PageSection
          ref="section2Ref"
          tone="light"
          layout="stacked"
          texture-preset="rightSoft"
          heading="Making art provides a way to <i>process</i>, <i>define</i>, and <i>express</i> complex identities."
        >
          <ActorsPreview />
        </PageSection>

        <!-- Section 3 ─ Persona content (always visible text) -->
        <PageSection ref="section3Ref" tone="light" layout="split" texture-preset="leftDual">
          <div
            class="grid h-full grid-cols-12 content-between gap-x-2 gap-y-8 md:grid-rows-[auto_1fr_auto] md:gap-x-4"
          >
            <h2 class="col-span-12 m-0 md:col-span-5">
              What makes up a persona?*
            </h2>
            <div class="hidden md:block md:col-span-2" aria-hidden="true"></div>
            <div class="col-span-12 flex justify-center md:col-span-5 md:justify-end">
              <img
                ref="section3PersonaRef"
                :src="personaSectionIllustrationSrc"
                alt=""
                class="w-full max-w-[28rem]"
                role="presentation"
              />
            </div>
            <p class="col-span-12 md:row-start-3 md:self-end">
              *A representation of artist identity constructed from texts that
              contextualize their work.
            </p>
          </div>
        </PageSection>

        <!-- Exhibition section -->
        <PageSection
          ref="timelineRef"
          tone="dark"
          layout="stacked"
          heading="...for modern and contemporary artists selected from exhibitions about identity?"
          subheading="*with a case study of mixed-race, Asian American identifying artists."
        >
          <ExhibitionsTimeline class="mt-8" />
          <div ref="exhibitionsAnchorStartRef" class="exhibitions-bridge-anchor" aria-hidden="true"></div>
        </PageSection>

        <!-- Sankey section -->
        <PageSection ref="sankeyRef" tone="dark" layout="stacked">
          <div ref="exhibitionsAnchorEndRef" class="exhibitions-bridge-anchor mb-6" aria-hidden="true"></div>
          <ExhibitionsSankey />
        </PageSection>

        <!-- Text-embedding cluster visualization -->
        <PageSection tone="light" layout="stacked" stacked-full-width>
          <ClusterSection
            :exhibitions="exhibitionClustersMap"
            :artist-data="artistClustersMap"
            :institution-data="institutionClustersMap"
            :artist-positions="artistPositionsMap"
            :institution-positions="institutionPositionsMap"
            initial-view-mode="exhibitions"
            @select-point="openClusterFromEmbedding"
            @select-cluster="openClusterFromEmbedding"
          />
        </PageSection>
      </main>
    </div>
  </div>

  <div ref="floatingPersonaRef" class="floating-persona">
    <img :src="personaSectionIllustrationSrc" alt="" class="floating-persona__img" />
  </div>

  <div ref="exhibitionsLabelRef" class="exhibitions-bridge-label">
    <div class="mx-auto w-full max-w-[1600px] px-4 md:px-8">
      <div class="grid grid-cols-12 gap-x-2 md:gap-x-4">
        <div class="col-span-12 md:col-span-9 md:col-start-1">
          <div class="exhibitions-bridge-label__track">
            <span class="exhibitions-bridge-label__inner">
              <span>Exhibitions</span><span class="exhibitions-bridge-label__suffix"> and artists</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <ClusterView
    v-if="expandedCluster"
    :cluster="expandedCluster"
    :groupBy="expandedClusterGroupBy"
    @close="closeClusterView"
  />
</template>
