<script setup>
import { computed, useSlots } from "vue";
import {
  DEFAULT_TEXTURE_PRESET,
  SECTION_TEXTURE_PRESETS,
} from "../../constants/section-texture-presets.js";

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
  /** Extra space between heading block and body when layout is not built-in split */
  stackedBodyGap: {
    type: String,
    default: "default",
    validator: (v) => ["default", "relaxed"].includes(v),
  },
  /**
   * When layout is stacked, use full 12-column width instead of the default 9-column cap.
   * Intended for occasional sections (e.g. cluster grid) that need edge-to-edge content.
   */
  stackedFullWidth: {
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

const sectionClasses = computed(() => [
  "page-section relative overflow-hidden",
  isLight.value ? "page-section--light" : "page-section--dark",
]);

const backgroundStyles = {
  backgroundImage: "url('/background.svg')",
  backgroundRepeat: "repeat",
  backgroundPosition: "center",
  backgroundSize: "cover",
};

const stackedBodyClass = computed(() =>
  props.stackedBodyGap === "relaxed"
    ? "page-section-body page-section-body--stacked page-section-body--relaxed"
    : "page-section-body page-section-body--stacked",
);

const stackedInnerColClass = computed(() =>
  props.stackedFullWidth
    ? "col-span-12 flex h-full flex-col"
    : "col-span-12 flex h-full flex-col md:col-span-9 md:col-start-1",
);
</script>

<template>
  <section :class="sectionClasses">
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
          src="/texture.svg"
          alt=""
          class="page-section-texture absolute"
          :style="texture"
        />
      </div>
    </transition>

    <div
      class="page-section-content relative z-10 mx-auto w-full max-w-[1600px] px-4 py-20 md:px-8 md:py-28"
      :class="scrollContent ? 'overflow-y-auto' : 'overflow-hidden'"
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
              v-html="resolvedSubheadingHtml"
            ></h3>
          </div>
        </div>
        <div class="hidden md:block md:col-span-2" aria-hidden="true"></div>
        <div class="col-span-12 md:col-span-5">
          <slot />
        </div>
      </div>
      <template v-else>
        <div v-if="layout === 'stacked'" class="grid grid-cols-12 gap-x-2 md:gap-x-4">
          <div :class="stackedInnerColClass">
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
                  v-html="resolvedSubheadingHtml"
                ></h3>
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
                v-html="resolvedSubheadingHtml"
              ></h3>
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
