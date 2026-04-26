<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import {
  artistClustersMap,
  institutionClustersMap,
  artistPositionsMap,
  institutionPositionsMap,
  exhibitionClustersMap,
  artistCount,
} from "./data/index.js";
import ClusterSection from "./components/ClusterSection/index.vue";
import ClusterView from "./components/ClusterView/index.vue";
import PageSection from "./components/PageSection/index.vue";
import IdentityStatesPreview from "./components/IdentityStatesPreview/index.vue";
import ActorsPreview from "./components/ActorsPreview/index.vue";
import ArtworkCollage from "./components/ArtworkCollage/index.vue";
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
const introCollageSrc = publicImgSrc("artworks-all.png");
const shellReady = ref(false);

const section2HeadingHtml = [
  "Identity is",
  '<span class="identity-heading__descriptors">',
  '<i class="identity-heading__descriptor identity-heading__descriptor--active" data-descriptor="descriptor1">collective</i>',
  '<i class="identity-heading__descriptor" data-descriptor="descriptor2">multifaceted</i>',
  '<i class="identity-heading__descriptor" data-descriptor="descriptor3">ever-developing</i>',
  "</span>",
].join("");

const section2Ref = ref(null);
const actorsRef = ref(null);
const section3Ref = ref(null);
const timelineRef = ref(null);
const sankeyRef = ref(null);
const clustersRef = ref(null);
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
          section2El: getSectionEl(section2Ref),
          actorsSectionEl: getSectionEl(actorsRef),
          section3El: getSectionEl(section3Ref),
          sectionAfterS3El: getSectionEl(timelineRef),
          floatingPersonaEl: floatingPersonaRef.value,
          section3PersonaImg: section3PersonaRef.value,
          exhibitionsLabelEl: exhibitionsLabelRef.value,
          exhibitionsAnchorStartEl: exhibitionsAnchorStartRef.value,
          exhibitionsAnchorEndRef: exhibitionsAnchorEndRef.value,
          sankeySectionEl: getSectionEl(sankeyRef),
          clusterSectionEl: getSectionEl(clustersRef),
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
        <!-- <ArtworkCollage /> -->
        <PageSection class="intro-section" tone="light" layout="stacked" stacked-full-width>
          <div class="grid min-h-[100svh] grid-cols-12 gap-x-2 md:gap-x-4">
            <div class="col-span-12 overflow-visible lg:col-span-6 sm:col-span-1">
              <img :src="introCollageSrc" alt="" class="intro-section__collage" role="presentation" />
            </div>
            <div class="col-span-12 flex items-end justify-end py-8 lg:col-span-5 lg:col-start-8 mb-8 sm:col-span-12 sm:col-start-2">
              <div class="intro-section__title-card">
                <h1 class="mb-8"><i>In Between</i> Portraits</h1>
                <p class="mb-8">
                  The matter of persona in constructing an artist's public identity
                </p>
                <p>c. 2026</p>
              </div>
            </div>
          </div>
        </PageSection>

        <!-- Section 2 ─ Identity states -->
        <PageSection
          ref="section2Ref"
          tone="dark"
          layout="split"
          :heading-html="section2HeadingHtml"
        >
          <IdentityStatesPreview :dot-count="artistCount" />
        </PageSection>

        <!-- Actors -->
        <PageSection
          ref="actorsRef"
          tone="light"
          layout="stacked"
          texture-preset="rightSoft"
          heading="Making art provides a way to <i>process</i>, <i>define</i>, and <i>express</i> complex identities."
        >
          <ActorsPreview />
        </PageSection>

        <!-- Persona -->
        <PageSection ref="section3Ref" tone="light" layout="split" texture-preset="leftDual">
          <div
            class="grid h-full grid-cols-12 content-between gap-x-2 gap-y-8 md:grid-rows-[auto_1fr_auto] md:gap-x-4"
          >
            <h2 class="col-span-12 m-0 md:col-span-5">
              What makes up a persona...*
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
          heading="for artists selected from exhibitions about identity?"
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
        <PageSection ref="clustersRef" tone="light" layout="stacked" stacked-full-width>
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
            <span class="exhibitions-bridge-label__token exhibitions-bridge-label__token--exhibitions">
              Exhibitions
            </span>
            <span class="exhibitions-bridge-label__token exhibitions-bridge-label__token--and">and</span>
            <span class="exhibitions-bridge-label__token exhibitions-bridge-label__token--artists">
              artists
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
