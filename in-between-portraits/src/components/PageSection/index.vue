<script setup>
import { computed, ref, useSlots } from "vue";
import {
  DEFAULT_TEXTURE_PRESET,
  SECTION_TEXTURE_PRESETS,
} from "../../constants/section-texture-presets.js";
import { publicImgSrc } from "../../utils/public-img-src.js";

const props = defineProps({
  tone: {
    type: String,
    default: "light",
  },
  layout: {
    type: String,
    default: "split",
  },
  heading: {
    type: String,
    default: "",
  },
  subheading: {
    type: String,
    default: "",
  },
  headingHtml: {
    type: String,
    default: "",
  },
  subheadingHtml: {
    type: String,
    default: "",
  },
  texturePreset: {
    type: String,
    default: DEFAULT_TEXTURE_PRESET,
  },
  scrollContent: {
    type: Boolean,
    default: false,
  },
  stackedBodyGap: {
    type: String,
    default: "default",
    validator: (v) => ["default", "relaxed"].includes(v),
  },
  stackedFullWidth: {
    type: Boolean,
    default: false,
  },
  stackedNarrowHeading: {
    type: Boolean,
    default: false,
  },
  stackedFillHeight: {
    type: Boolean,
    default: false,
  },
});

const slots = useSlots();

const isLight = computed(() => props.tone === "light");
const hasHeadingSlot = computed(() => Boolean(slots.heading));
const hasHeadingContent = computed(
  () => props.heading || props.subheading || props.headingHtml || props.subheadingHtml,
);
const resolvedHeadingHtml = computed(() => props.headingHtml || props.heading);
const resolvedSubheadingHtml = computed(() => props.subheadingHtml || props.subheading);
const usesBuiltInSplitHeading = computed(
  () => props.layout === "split" && !hasHeadingSlot.value && hasHeadingContent.value,
);
const textures = computed(
  () =>
    SECTION_TEXTURE_PRESETS[props.texturePreset] ??
    SECTION_TEXTURE_PRESETS[DEFAULT_TEXTURE_PRESET],
);

const sectionClasses = computed(() => {
  const classes = [
    "page-section relative overflow-hidden",
    isLight.value ? "page-section--light" : "page-section--dark",
  ];
  if (props.stackedFillHeight) classes.push("page-section--viz-fill");
  return classes;
});

const textureSrc = publicImgSrc("texture.svg");

const backgroundStyles = computed(() => ({
  backgroundImage: `url('${publicImgSrc("background.svg")}')`,
  backgroundRepeat: "repeat",
  backgroundPosition: "center",
  backgroundSize: "cover",
}));

const stackedBodyClass = computed(() => {
  const base =
    props.stackedBodyGap === "relaxed"
      ? "page-section-body page-section-body--stacked page-section-body--relaxed"
      : "page-section-body page-section-body--stacked";
  return props.stackedFillHeight ? `${base} page-section-body--stacked-fill` : base;
});

const stackedInnerColClass = computed(() => {
  const base = props.stackedFullWidth
    ? "col-span-12 flex h-full min-h-0 flex-col"
    : "col-span-12 flex h-full min-h-0 flex-col md:col-span-9 md:col-start-1";
  return props.stackedFillHeight ? `${base} overflow-visible` : base;
});

const stackedOuterGridClass = computed(() => {
  const base = "grid grid-cols-12 gap-x-2 md:gap-x-4";
  return props.stackedFillHeight
    ? `${base} min-h-0 flex-1 grid-rows-[minmax(0,1fr)] overflow-visible`
    : base;
});

const stackedSplitHeadingBody = computed(
  () => props.layout === "stacked" && props.stackedFullWidth && props.stackedNarrowHeading,
);

const pageSectionContentOverflowClass = computed(() => {
  if (props.scrollContent) return "overflow-y-auto";
  if (props.stackedFillHeight) return "overflow-visible";
  return "overflow-hidden";
});

const pageSectionContentHorizontalPadClass = computed(
  () => `px-4${props.stackedFillHeight && props.stackedFullWidth ? "" : " md:px-8"}`,
);

const sectionEl = ref(null);
defineExpose({ sectionEl });
</script>

<template>
  <section ref="sectionEl" :class="sectionClasses">
    <div class="page-section-background" aria-hidden="true" :style="backgroundStyles" />
    <transition name="texture-fade">
      <div
        v-if="isLight"
        class="pointer-events-none absolute -inset-x-28 -inset-y-40 z-1"
        aria-hidden="true"
      >
        <img
          v-for="(texture, index) in textures"
          :key="`${texturePreset}-${index}`"
          :src="textureSrc"
          alt=""
          class="page-section-texture absolute"
          :style="texture"
        />
      </div>
    </transition>

    <div
      class="page-section-content relative z-10 mx-auto w-full max-w-[1600px] pt-20 pb-8 md:pt-28 md:pb-8"
      :class="[pageSectionContentOverflowClass, pageSectionContentHorizontalPadClass]"
    >
      <div
        v-if="usesBuiltInSplitHeading"
        class="grid h-full grid-cols-12 gap-x-2 gap-y-8 md:gap-x-4"
      >
        <div class="col-span-12 md:col-span-5">
          <div class="page-section-heading-block">
            <h2 v-if="resolvedHeadingHtml" class="page-section-heading" v-html="resolvedHeadingHtml"></h2>
            <h3
              v-if="resolvedSubheadingHtml"
              class="page-section-subheading"
            >
              <span v-html="resolvedSubheadingHtml"></span>
              <slot name="subheading-addon" />
            </h3>
          </div>
        </div>
        <div class="hidden md:block md:col-span-2" aria-hidden="true"></div>
        <div class="col-span-12 md:col-span-5">
          <slot />
        </div>
      </div>
      <template v-else>
        <div v-if="layout === 'stacked'" :class="stackedOuterGridClass">
          <template v-if="stackedSplitHeadingBody">
            <div class="col-span-12 md:col-span-10 md:col-start-1">
              <slot name="heading">
                <div v-if="hasHeadingContent" class="page-section-heading-block">
                  <h2
                    v-if="resolvedHeadingHtml"
                    class="page-section-heading"
                    v-html="resolvedHeadingHtml"
                  ></h2>
                  <h3
                    v-if="resolvedSubheadingHtml"
                    class="page-section-subheading"
                  >
                    <span v-html="resolvedSubheadingHtml"></span>
                    <slot name="subheading-addon" />
                  </h3>
                </div>
              </slot>
            </div>
            <div class="col-span-12 flex h-full min-h-0 min-w-0 flex-col">
              <div :class="stackedBodyClass">
                <slot />
              </div>
            </div>
          </template>
          <div v-else :class="stackedInnerColClass">
            <slot name="heading">
              <div v-if="hasHeadingContent" class="page-section-heading-block">
                <h2
                  v-if="resolvedHeadingHtml"
                  class="page-section-heading"
                  v-html="resolvedHeadingHtml"
                ></h2>
                <h3
                  v-if="resolvedSubheadingHtml"
                  class="page-section-subheading"
                >
                  <span v-html="resolvedSubheadingHtml"></span>
                  <slot name="subheading-addon" />
                </h3>
              </div>
            </slot>
            <div :class="stackedBodyClass">
              <slot />
            </div>
          </div>
        </div>
        <template v-else>
          <slot name="heading">
            <div v-if="hasHeadingContent" class="page-section-heading-block">
              <h2 v-if="resolvedHeadingHtml" class="page-section-heading" v-html="resolvedHeadingHtml"></h2>
              <h3
                v-if="resolvedSubheadingHtml"
                class="page-section-subheading"
              >
                <span v-html="resolvedSubheadingHtml"></span>
                <slot name="subheading-addon" />
              </h3>
            </div>
          </slot>
          <div :class="stackedBodyClass">
            <slot />
          </div>
        </template>
      </template>
    </div>
  </section>
</template>

<style scoped src="./style.css"></style>
