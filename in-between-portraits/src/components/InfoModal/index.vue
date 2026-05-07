<script setup>
import { computed, onBeforeUnmount, onMounted, ref, useId, watch } from "vue";

function plainTextFromHeadingHtml(html) {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const props = defineProps({
  headingHtml: {
    type: String,
    default: "",
  },
  heading: {
    type: String,
    default: "",
  },
  bulletPoints: {
    type: Array,
    default: () => [],
  },
  ariaLabel: {
    type: String,
    default: "Open information modal",
  },
  listType: {
    type: String,
    default: "bullet",
    validator: (value) => ["bullet", "numbered"].includes(value),
  },
  smallText: {
    type: Boolean,
    default: false,
  },
  triggerTitle: {
    type: String,
    default: undefined,
  },
});

const isOpen = ref(false);
const triggerRef = ref(null);
const isDarkContext = ref(false);
const resolvedHeadingHtml = computed(() =>
  props.headingHtml ? props.headingHtml.replace(/\n/g, "<br>") : props.heading,
);

const triggerNativeTitle = computed(() => {
  if (props.triggerTitle !== undefined) {
    return props.triggerTitle;
  }
  if (props.heading) {
    return props.heading;
  }
  const fromHtml = plainTextFromHeadingHtml(props.headingHtml);
  if (fromHtml) {
    return fromHtml;
  }
  return props.ariaLabel;
});
const titleId = useId();
let originalBodyOverflow = "";

const inferredTheme = computed(() => (isDarkContext.value ? "dark" : "light"));
const modalTheme = computed(() => (inferredTheme.value === "dark" ? "dark" : "light"));
const listTag = computed(() => (props.listType === "numbered" ? "ol" : "ul"));
const listClassName = computed(() =>
  props.listType === "numbered"
    ? "info-overlay-button__list info-overlay-button__list--numbered"
    : "info-overlay-button__list info-overlay-button__list--bullet",
);

function updateContextTheme() {
  if (!triggerRef.value || typeof window === "undefined") return;
  const darkParent = triggerRef.value.closest(".page-section--dark");
  isDarkContext.value = Boolean(darkParent);
}

function openModal() {
  isOpen.value = true;
}

function closeModal() {
  isOpen.value = false;
}

function onOverlayClick(event) {
  if (event.target === event.currentTarget) {
    closeModal();
  }
}

function onKeydown(event) {
  if (event.key === "Escape" && isOpen.value) {
    closeModal();
  }
}

onMounted(() => {
  updateContextTheme();
  window.addEventListener("keydown", onKeydown);
});

watch(isOpen, (nextValue) => {
  if (typeof document === "undefined") return;
  if (nextValue) {
    updateContextTheme();
    originalBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return;
  }
  document.body.style.overflow = originalBodyOverflow;
});

onBeforeUnmount(() => {
  if (typeof window !== "undefined") {
    window.removeEventListener("keydown", onKeydown);
  }
  if (typeof document !== "undefined") {
    document.body.style.overflow = originalBodyOverflow;
  }
});
</script>

<template>
  <span
    class="info-overlay-button"
    :class="{ 'info-overlay-button--small': smallText }"
    ref="triggerRef"
  >
    <button
      type="button"
      class="info-overlay-button__trigger label-text"
      :class="`info-overlay-button__trigger--${inferredTheme}`"
      :aria-label="ariaLabel"
      :title="triggerNativeTitle"
      :aria-expanded="isOpen ? 'true' : 'false'"
      :aria-controls="titleId"
      @click="openModal"
    >
      i
    </button>
  </span>

  <Teleport to="body">
    <div
      v-if="isOpen"
      class="info-overlay-button__overlay"
      :class="`info-overlay-button__overlay--${modalTheme}`"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      @click="onOverlayClick"
    >
      <div class="info-overlay-button__modal">
        <div class="info-overlay-button__header">
          <h3 :id="titleId" class="info-overlay-button__heading" v-html="resolvedHeadingHtml"></h3>
          <button
            type="button"
            class="info-overlay-button__close"
            aria-label="Close information modal"
            @click="closeModal"
          >
            ×
          </button>
        </div>
        <component :is="listTag" :class="listClassName">
          <template v-for="(point, idx) in bulletPoints" :key="`${idx}-${point}`">
            <li v-if="point !== ''" class="info-overlay-button__item">
              {{ point }}
            </li>
            <div v-else class="info-overlay-button__separator" aria-hidden="true"></div>
          </template>
        </component>
      </div>
    </div>
  </Teleport>
</template>

<style scoped src="./style.css"></style>
