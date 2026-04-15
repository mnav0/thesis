import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollSmoother } from "gsap/ScrollSmoother";

const SMOOTH_WRAPPER_ID = "#smooth-wrapper";
const SMOOTH_CONTENT_ID = "#smooth-content";

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
    .set(floatingEl, { opacity: 1 }, 0.28)
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

  gsap.set(sectionAfterS3El, { position: "relative", zIndex: 2 });

  ScrollTrigger.create({
    trigger: s3El,
    start: "top top",
    endTrigger: sectionAfterS3El,
    end: "top top",
    pin: true,
    pinSpacing: false,
    onEnter: () => {
      gsap.set(floatingEl, { opacity: 0 });
      gsap.set(s3PersonaImg, { opacity: 1 });
    },
    onLeaveBack: () => {
      gsap.set(floatingEl, { opacity: 1 });
      gsap.set(s3PersonaImg, { opacity: 0 });
    },
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

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function centerFromRect(rect, rootRect) {
  return {
    x: rect.left + rect.width / 2 - rootRect.left,
    y: rect.top + rect.height / 2 - rootRect.top,
  };
}

function setupSankeyToClusterDotTravel({
  sankeySectionEl,
  clusterSectionEl,
}) {
  if (!sankeySectionEl || !clusterSectionEl) return;

  const GROUP_STAGGER_STEP = 0.03;
  const GROUP_STAGGER_MAX = 0.24;
  const TRAVEL_PROGRESS_SPAN = 0.7;
  const LANDING_REVEAL_PROGRESS = 0.68;
  const contentEl = document.querySelector(SMOOTH_CONTENT_ID);
  if (!contentEl) return;
  const overlayEl = document.createElement("div");
  overlayEl.className = "sankey-cluster-travel-overlay";
  contentEl.appendChild(overlayEl);

  let pairs = [];
  let sourceNodes = [];
  let targetNodes = [];

  function setClusterLayerHidden(hidden) {
    clusterSectionEl.classList.toggle("cluster-travel-active", hidden);
  }

  function clearOverlayDots() {
    overlayEl.replaceChildren();
    pairs = [];
  }

  function resetOriginalDots() {
    sourceNodes.forEach((node) => {
      node.style.opacity = "";
    });
    targetNodes.forEach((node) => {
      node.style.opacity = "";
    });
    setClusterLayerHidden(false);
  }

  function getGroupIndexByClusterId(nodes) {
    const clusterIdSet = new Set();
    nodes.forEach((node) => {
      const pointId = node.dataset.pointId ?? "";
      const clusterId = pointId.split("-")[0];
      if (clusterId !== "") {
        clusterIdSet.add(clusterId);
      }
    });
    return new Map(
      [...clusterIdSet]
        .sort((a, b) => Number(a) - Number(b))
        .map((clusterId, index) => [clusterId, index]),
    );
  }

  function collectPairs() {
    const contentRect = contentEl.getBoundingClientRect();
    sourceNodes = [
      ...sankeySectionEl.querySelectorAll("[data-artist-id]"),
    ];
    targetNodes = [
      ...clusterSectionEl.querySelectorAll(".cs-point[data-artist-id]"),
    ];

    if (!sourceNodes.length || !targetNodes.length) return [];

    const sourceByArtistId = new Map();
    sourceNodes.forEach((node) => {
      const artistId = node.dataset.artistId;
      if (!artistId || sourceByArtistId.has(artistId)) return;
      sourceByArtistId.set(artistId, node);
    });

    const groupIndexByClusterId = getGroupIndexByClusterId(targetNodes);
    const out = [];
    targetNodes.forEach((targetNode) => {
      const artistId = targetNode.dataset.artistId;
      const sourceNode = artistId ? sourceByArtistId.get(artistId) : null;
      if (!sourceNode) return;

      const sourceCenter = centerFromRect(sourceNode.getBoundingClientRect(), contentRect);
      const targetCenter = centerFromRect(targetNode.getBoundingClientRect(), contentRect);
      const clusterId = (targetNode.dataset.pointId ?? "").split("-")[0];
      const groupIndex = groupIndexByClusterId.get(clusterId) ?? 0;
      const delay = Math.min(groupIndex * GROUP_STAGGER_STEP, GROUP_STAGGER_MAX);

      const proxyDotEl = document.createElement("div");
      proxyDotEl.className = "sankey-cluster-travel-dot";
      overlayEl.appendChild(proxyDotEl);

      out.push({
        sourceX: sourceCenter.x,
        sourceY: sourceCenter.y,
        targetX: targetCenter.x,
        targetY: targetCenter.y,
        delay,
        proxyDotEl,
      });
    });

    return out;
  }

  function applyProgress(progress) {
    const p = clamp01(progress);
    if (!pairs.length) {
      resetOriginalDots();
      return;
    }

    const hideClusterLayer = p < LANDING_REVEAL_PROGRESS;
    setClusterLayerHidden(hideClusterLayer);

    sourceNodes.forEach((node) => {
      node.style.opacity = String(1 - p * 0.95);
    });
    targetNodes.forEach((node) => {
      if (hideClusterLayer) {
        node.style.opacity = "0";
        return;
      }
      const revealP = clamp01((p - LANDING_REVEAL_PROGRESS) / (1 - LANDING_REVEAL_PROGRESS));
      node.style.opacity = String(revealP);
    });

    pairs.forEach((pair) => {
      const localProgress = clamp01((p - pair.delay) / TRAVEL_PROGRESS_SPAN);
      const x = pair.sourceX + (pair.targetX - pair.sourceX) * localProgress;
      const y = pair.sourceY + (pair.targetY - pair.sourceY) * localProgress;
      pair.proxyDotEl.style.transform = `translate(${x}px, ${y}px)`;
      pair.proxyDotEl.style.opacity = localProgress <= 0 ? "0" : "1";
    });
  }

  function rebuild(progress = 0) {
    clearOverlayDots();
    resetOriginalDots();
    pairs = collectPairs();
    applyProgress(progress);
  }

  function cleanup() {
    clearOverlayDots();
    resetOriginalDots();
  }

  const trigger = ScrollTrigger.create({
    trigger: sankeySectionEl,
    start: "bottom bottom",
    endTrigger: clusterSectionEl,
    end: "top top",
    scrub: 1,
    onEnter: () => rebuild(0),
    onEnterBack: () => rebuild(1),
    onUpdate: (self) => applyProgress(self.progress),
    onRefresh: (self) => rebuild(self.progress),
    onLeave: () => cleanup(),
    onLeaveBack: () => cleanup(),
    onKill: () => cleanup(),
  });

  return () => {
    cleanup();
    trigger.kill();
    overlayEl.remove();
  };
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
 * @param {HTMLElement | null} [options.clusterSectionEl]
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
  clusterSectionEl,
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

  setupSankeyToClusterDotTravel({
    sankeySectionEl,
    clusterSectionEl,
  });

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
