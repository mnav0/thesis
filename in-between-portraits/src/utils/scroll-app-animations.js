import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollSmoother } from "gsap/ScrollSmoother";

const SMOOTH_WRAPPER_ID = "#smooth-wrapper";
const SMOOTH_CONTENT_ID = "#smooth-content";
const SCROLL_RESTORE_KEY = "ibp:smoother-scroll-y";

let scrollRestoreListenersInstalled = false;

/**
 * Persists ScrollSmoother scroll position before unload/refresh so the next load
 * can restore after pins and ScrollTrigger have been recalculated.
 */
export function installScrollRestoreListeners() {
  if (typeof window === "undefined" || scrollRestoreListenersInstalled) return;
  scrollRestoreListenersInstalled = true;

  window.addEventListener("pagehide", () => {
    try {
      const smoother = ScrollSmoother.get();
      const y = smoother?.scrollTop?.() ?? window.scrollY ?? 0;
      sessionStorage.setItem(SCROLL_RESTORE_KEY, String(Math.max(0, y)));
    } catch {
      /* ignore */
    }
  });
}

function restoreSavedScroll(smoother) {
  if (!smoother || typeof window === "undefined") return;

  const raw = sessionStorage.getItem(SCROLL_RESTORE_KEY);
  if (raw == null) return;

  sessionStorage.removeItem(SCROLL_RESTORE_KEY);
  const y = Math.max(0, Number.parseFloat(raw));
  if (!Number.isFinite(y)) return;

  requestAnimationFrame(() => {
    smoother.scrollTo(y, false);
    ScrollTrigger.refresh();
  });
}

/**
 * Measures floating-persona start (actors icon) and end (section 3 image) rects
 * in viewport / section-local coordinates for GSAP.
 */
function measurePersonaPositions(section2El, section3El, personaIcon, section3PersonaImg) {
  if (!personaIcon || !section3PersonaImg) return null;

  const s2Rect = section2El.getBoundingClientRect();
  const iconRect = personaIcon.getBoundingClientRect();
  const s3Rect = section3El.getBoundingClientRect();
  const s3PRect = section3PersonaImg.getBoundingClientRect();

  return {
    start: {
      x: iconRect.left,
      y: iconRect.top - s2Rect.top,
      w: iconRect.width,
      h: iconRect.height,
    },
    end: {
      x: s3PRect.left,
      y: s3PRect.top - s3Rect.top,
      w: s3PRect.width,
      h: s3PRect.height,
    },
  };
}

function setupSection1Intro(s1El, onFirstSectionToneChange) {
  s1El.style.transition = "none";
  s1El.querySelectorAll("h2, h3").forEach((el) => {
    el.style.transition = "none";
  });

  const shortH = s1El.querySelector(".s1-short");
  const expandedH = s1El.querySelector(".s1-expanded");
  const s1Bg = s1El.querySelector(".page-section-background");

  if (!shortH || !expandedH) return;

  let lastTone = null;
  const s1Tl = gsap.timeline({
    scrollTrigger: {
      trigger: s1El,
      start: "top top",
      end: "+=100%",
      pin: true,
      scrub: 1,
      onUpdate: (self) => {
        const tone = self.progress > 0.3 ? "light" : "dark";
        if (tone !== lastTone) {
          lastTone = tone;
          onFirstSectionToneChange(tone);
        }
      },
    },
  });

  s1Tl
    .to(shortH, { opacity: 0, duration: 0.4 }, 0)
    .to(expandedH, { opacity: 1, duration: 0.5 }, 0.15)
    .to(
      s1El,
      {
        backgroundColor: "#fff",
        borderColor: "#000",
        color: "#333",
        duration: 0.7,
      },
      0
    )
    .to(s1Bg, { opacity: 1, duration: 0.7 }, 0);

  const clusterItems = s1El.querySelectorAll(".cluster-preview-item");
  if (clusterItems.length) {
    s1Tl.to(clusterItems, { color: "#b8b8b8", duration: 0.7 }, 0);
  }
}

function setupSection2PersonaGrow({
  s2El,
  s3El,
  sectionAfterS3El,
  floatingEl,
  s3PersonaImg,
  personaPos,
}) {
  const personaIcon = s2El.querySelector(
    '[data-actor="persona"] .actors-preview__icon'
  );
  const personaCell = s2El.querySelector('[data-actor="persona"]');
  const nonPersonaCells = s2El.querySelectorAll(
    '.actors-preview__cell:not([data-actor="persona"])'
  );
  const personaLabel = personaCell?.querySelector("span");
  const s2Heading = s2El.querySelector(".page-section-heading");

  gsap.set(floatingEl, {
    left: personaPos.start.x,
    top: personaPos.start.y,
    width: personaPos.start.w,
    height: personaPos.start.h,
    opacity: 0,
  });

  gsap.set(s3PersonaImg, { opacity: 0 });

  const s2Tl = gsap.timeline({
    scrollTrigger: {
      trigger: s2El,
      start: "top top",
      end: "+=150%",
      pin: true,
      scrub: 1,
    },
  });

  s2Tl
    .to(s2Heading, { opacity: 0, duration: 0.25 }, 0)
    .to(nonPersonaCells, { opacity: 0, duration: 0.25 }, 0)
    .to(personaLabel, { opacity: 0, duration: 0.2 }, 0.1);

  s2Tl
    .set(personaIcon, { visibility: "hidden" }, 0.28)
    .to(
      floatingEl,
      {
        left: personaPos.end.x,
        top: personaPos.end.y,
        width: personaPos.end.w,
        height: personaPos.end.h,
        duration: 0.55,
        ease: "power2.inOut",
      },
      0.3
    );

  function syncPersonaVisibility(self) {
    const showFloating = self.isActive;
    gsap.set(floatingEl, { opacity: showFloating ? 1 : 0 });
    gsap.set(s3PersonaImg, { opacity: showFloating ? 0 : 1 });
  }

  // Root fix: visibility is derived from active scroll range, not enter/leave events.
  ScrollTrigger.create({
    trigger: s2El,
    start: "top top",
    endTrigger: s3El,
    end: "top top",
    invalidateOnRefresh: true,
    onUpdate: syncPersonaVisibility,
    onToggle: syncPersonaVisibility,
    onRefresh: syncPersonaVisibility,
  });

  gsap.set(sectionAfterS3El, { position: "relative", zIndex: 2 });

  ScrollTrigger.create({
    trigger: s3El,
    start: "top top",
    endTrigger: sectionAfterS3El,
    end: "top top",
    pin: true,
    pinSpacing: false,
  });
}

function setupSection3PinCoverFallback(s3El, sectionAfterS3El) {
  gsap.set(sectionAfterS3El, { position: "relative", zIndex: 2 });
  ScrollTrigger.create({
    trigger: s3El,
    start: "top top",
    endTrigger: sectionAfterS3El,
    end: "top top",
    pin: true,
    pinSpacing: false,
  });
}

/**
 * Fixed label (outside #smooth-wrapper) tracks two anchors inside the scroll
 * content — one below the timeline SVG, one above the Sankey.  As the user
 * scrolls, the label's `top` interpolates between the anchors' live viewport
 * positions, creating visible downward travel.  Then x-shift and suffix fade.
 */
function setupExhibitionsLabel({
  labelEl,
  startAnchorEl,
  endAnchorEl,
  timelineSectionEl,
  sankeySectionEl,
}) {
  if (!labelEl || !startAnchorEl || !endAnchorEl || !timelineSectionEl || !sankeySectionEl) return;

  const innerEl = labelEl.querySelector(".exhibitions-bridge-label__inner");
  const suffixEl = labelEl.querySelector(".exhibitions-bridge-label__suffix");
  if (!innerEl || !suffixEl) return;

  const suffixWidth = suffixEl.getBoundingClientRect().width;
  gsap.set(innerEl, { x: suffixWidth / 2 });
  gsap.set(suffixEl, { opacity: 0 });

  function applyProgress(p) {
    const startTop = startAnchorEl.getBoundingClientRect().top;
    const endTop = endAnchorEl.getBoundingClientRect().top;

    const yP = Math.min(p / 0.15, 1);
    const top = yP >= 1 ? endTop : startTop + (endTop - startTop) * yP;
    gsap.set(labelEl, { top, opacity: 1 });

    const xP = gsap.utils.clamp(0, 1, (p - 0.15) / 0.06);
    gsap.set(innerEl, { x: suffixWidth / 2 * (1 - xP) });

    const fP = gsap.utils.clamp(0, 1, (p - 0.21) / 0.06);
    gsap.set(suffixEl, { opacity: fP });
  }

  let arrived = false;

  function trackStartAnchor() {
    const top = startAnchorEl.getBoundingClientRect().top;
    gsap.set(labelEl, { top, opacity: 1 });
  }

  ScrollTrigger.create({
    trigger: startAnchorEl,
    start: "top bottom",
    endTrigger: timelineSectionEl,
    end: "bottom bottom",
    onUpdate: () => trackStartAnchor(),
    onEnter: () => trackStartAnchor(),
    onLeaveBack: () => gsap.set(labelEl, { opacity: 0 }),
  });

  ScrollTrigger.create({
    trigger: timelineSectionEl,
    start: "bottom bottom",
    endTrigger: sankeySectionEl,
    end: "bottom top",
    onUpdate: (self) => {
      applyProgress(self.progress);
      arrived = self.progress >= 0.15;
    },
    onLeave: () => gsap.set(labelEl, { opacity: 0 }),
    onLeaveBack: () => trackStartAnchor(),
    onEnter: () => applyProgress(0),
    onEnterBack: () => {
      arrived = true;
      applyProgress(1);
    },
  });

  applyProgress(0);
}

/**
 * Initializes ScrollSmoother and all app section ScrollTriggers.
 *
 * @param {object} options
 * @param {HTMLElement} options.section1El
 * @param {HTMLElement} options.section2El
 * @param {HTMLElement} options.section3El
 * @param {HTMLElement} options.sectionAfterS3El First section after persona (pin end / z-index cover)
 * @param {HTMLElement | null} options.floatingPersonaEl
 * @param {HTMLImageElement | null} options.section3PersonaImg
 * @param {(tone: 'light' | 'dark') => void} options.onFirstSectionToneChange
 * @param {HTMLElement | null} [options.exhibitionsLabelEl]
 * @param {HTMLElement | null} [options.exhibitionsAnchorStartEl]
 * @param {HTMLElement | null} [options.exhibitionsAnchorEndEl]
 * @param {HTMLElement | null} [options.sankeySectionEl]
 * @returns {object | null} ScrollSmoother instance, or null if required sections missing
 */
export function initAppScrollAnimations({
  section1El,
  section2El,
  section3El,
  sectionAfterS3El,
  floatingPersonaEl,
  section3PersonaImg,
  onFirstSectionToneChange,
  exhibitionsLabelEl,
  exhibitionsAnchorStartEl,
  exhibitionsAnchorEndEl,
  sankeySectionEl,
}) {
  if (!section1El || !section2El || !section3El || !sectionAfterS3El) return null;

  const personaIcon = section2El.querySelector(
    '[data-actor="persona"] .actors-preview__icon'
  );

  const personaPos = measurePersonaPositions(
    section2El,
    section3El,
    personaIcon,
    section3PersonaImg
  );

  const smoother = ScrollSmoother.create({
    wrapper: SMOOTH_WRAPPER_ID,
    content: SMOOTH_CONTENT_ID,
    smooth: 1.5,
    effects: true,
  });

  setupSection1Intro(section1El, onFirstSectionToneChange);

  if (personaPos && floatingPersonaEl && section3PersonaImg) {
    setupSection2PersonaGrow({
      s2El: section2El,
      s3El: section3El,
      sectionAfterS3El,
      floatingEl: floatingPersonaEl,
      s3PersonaImg: section3PersonaImg,
      personaPos,
    });
  } else {
    setupSection3PinCoverFallback(section3El, sectionAfterS3El);
  }

  setupExhibitionsLabel({
    labelEl: exhibitionsLabelEl,
    startAnchorEl: exhibitionsAnchorStartEl,
    endAnchorEl: exhibitionsAnchorEndEl,
    timelineSectionEl: sectionAfterS3El,
    sankeySectionEl,
  });

  ScrollTrigger.refresh();
  restoreSavedScroll(smoother);

  return smoother;
}

/**
 * Kills all ScrollTriggers and the ScrollSmoother instance from init.
 * @param {object | null | undefined} smoother
 */
export function destroyAppScrollAnimations(smoother) {
  ScrollTrigger.getAll().forEach((t) => t.kill());
  smoother?.kill();
}
