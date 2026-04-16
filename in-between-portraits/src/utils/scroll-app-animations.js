import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollSmoother } from "gsap/ScrollSmoother";

const SMOOTH_WRAPPER_ID = "#smooth-wrapper";
const SMOOTH_CONTENT_ID = "#smooth-content";

function measurePersonaPositions(actorsEl, section3El, personaIcon, section3PersonaImg) {
  if (!actorsEl || !section3El || !personaIcon || !section3PersonaImg) return null;

  const s2Rect = actorsEl.getBoundingClientRect();
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

/**
 * Section 1 intro bridge:
 * pin section 1, fade bg light→dark, transition portrait borders
 * black→white, fade dots/title/subtitle, then release to section 2.
 */
function setupIntroBridge(section1El, onFirstSectionToneChange) {
  const s1Bg = section1El.querySelector(".page-section-background");
  const portraitBlock = section1El.querySelector(".intro-portrait-block");
  const portraitFrames = section1El.querySelectorAll(".intro-portrait-block__frame");
  const portraitDots = section1El.querySelectorAll(".intro-portrait-block__dots span");
  const titleEl = section1El.querySelector("h1");
  const subtitleEl = section1El.querySelector(".intro-subtitle");

  section1El.style.transition = "none";
  section1El.querySelectorAll("h1, h2, h3").forEach((el) => {
    el.style.transition = "none";
  });
  if (portraitBlock) gsap.set(portraitBlock, { visibility: "visible" });

  let lastTone = "light";
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: section1El,
      start: "top top",
      end: "+=100%",
      pin: true,
      scrub: 1,
      onUpdate: (self) => {
        const tone = self.progress > 0.4 ? "dark" : "light";
        if (tone !== lastTone) {
          lastTone = tone;
          onFirstSectionToneChange(tone);
        }
      },
    },
  });

  // Phase 1 (0–0.4): Section goes dark
  tl.to(
    section1El,
    { backgroundColor: "#000", borderColor: "transparent", color: "#fff", duration: 0.35 },
    0.05,
  );
  if (s1Bg) {
    tl.to(s1Bg, { opacity: 0, duration: 0.35 }, 0.05);
  }

  // Portrait borders transition to white (matching section 2 dark style)
  tl.to(portraitFrames, { borderColor: "rgba(255,255,255,0.45)", duration: 0.3 }, 0.1);
  // Dots transition out
  tl.to(portraitDots, { opacity: "0", duration: 0.3 }, 0.1);

  // Phase 2 (0.4–0.7): Title and subtitle fade out, portrait stays
  if (titleEl) tl.to(titleEl, { opacity: 0, duration: 0.25 }, 0.4);
  if (subtitleEl) tl.to(subtitleEl, { opacity: 0, duration: 0.25 }, 0.4);
}

function setIdentityState(sectionEl, stateId) {
  const descriptorMap = {
    descriptor1: "descriptor1",
    descriptor2: "descriptor2",
    descriptor3_1: "descriptor3",
    descriptor3_2: "descriptor3",
    descriptor3_3: "descriptor3",
  };
  const activeDescriptor = descriptorMap[stateId];
  sectionEl.querySelectorAll("[data-descriptor]").forEach((node) => {
    node.classList.toggle(
      "identity-heading__descriptor--active",
      node.dataset.descriptor === activeDescriptor,
    );
  });
  sectionEl.querySelectorAll("[data-state]").forEach((node) => {
    node.classList.toggle("identity-state--active", node.dataset.state === stateId);
  });
}

function setupIdentitySectionTimeline(section2El) {
  setIdentityState(section2El, "descriptor1");
  const frames = section2El.querySelectorAll(".identity-states-preview__frame");

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: section2El,
      start: "top top",
      end: "+=260%",
      pin: true,
      scrub: 1,
    },
  });

  tl.call(() => {
    setIdentityState(section2El, "descriptor1");
    gsap.to(frames, { opacity: 1, duration: 0.2 });
  }, null, 0)
    .to({}, { duration: 0.55 })
    .call(() => {
      setIdentityState(section2El, "descriptor2");
      gsap.to(frames, { opacity: 0, duration: 0.3 });
    })
    .to({}, { duration: 0.65 })
    .call(() => setIdentityState(section2El, "descriptor3_1"))
    .to({}, { duration: 0.45 })
    .call(() => setIdentityState(section2El, "descriptor3_2"))
    .to({}, { duration: 0.45 })
    .call(() => setIdentityState(section2El, "descriptor3_3"))
    .to({}, { duration: 0.4 });
}

function setupActorsToPersonaGrow({
  actorsEl,
  s3El,
  sectionAfterS3El,
  floatingEl,
  s3PersonaImg,
  personaPos,
}) {
  const personaIcon = actorsEl.querySelector(
    '[data-actor="persona"] .actors-preview__icon',
  );
  const personaCell = actorsEl.querySelector('[data-actor="persona"]');
  const nonPersonaCells = actorsEl.querySelectorAll(
    '.actors-preview__cell:not([data-actor="persona"])',
  );
  const personaLabel = personaCell?.querySelector("span");
  const s2Heading = actorsEl.querySelector(".page-section-heading");

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
      trigger: actorsEl,
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
      0.3,
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
    gsap.set(innerEl, { x: (suffixWidth / 2) * (1 - xP) });

    const fP = gsap.utils.clamp(0, 1, (p - 0.21) / 0.06);
    gsap.set(suffixEl, { opacity: fP });
  }

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
    onUpdate: (self) => applyProgress(self.progress),
    onLeave: () => gsap.set(labelEl, { opacity: 0 }),
    onLeaveBack: () => trackStartAnchor(),
    onEnter: () => applyProgress(0),
    onEnterBack: () => applyProgress(1),
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

function setupSankeyToClusterDotTravel({ sankeySectionEl, clusterSectionEl }) {
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
    sourceNodes.forEach((node) => { node.style.opacity = ""; });
    targetNodes.forEach((node) => { node.style.opacity = ""; });
    setClusterLayerHidden(false);
  }

  function getGroupIndexByClusterId(nodes) {
    const clusterIdSet = new Set();
    nodes.forEach((node) => {
      const pointId = node.dataset.pointId ?? "";
      const clusterId = pointId.split("-")[0];
      if (clusterId !== "") clusterIdSet.add(clusterId);
    });
    return new Map(
      [...clusterIdSet]
        .sort((a, b) => Number(a) - Number(b))
        .map((clusterId, index) => [clusterId, index]),
    );
  }

  function collectPairs() {
    const contentRect = contentEl.getBoundingClientRect();
    sourceNodes = [...sankeySectionEl.querySelectorAll("[data-artist-id]")];
    targetNodes = [...clusterSectionEl.querySelectorAll(".cs-point[data-artist-id]")];
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

    sourceNodes.forEach((node) => { node.style.opacity = String(1 - p * 0.95); });
    targetNodes.forEach((node) => {
      if (hideClusterLayer) { node.style.opacity = "0"; return; }
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

  ScrollTrigger.create({
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
}

export function initAppScrollAnimations({
  section1El,
  section2El,
  actorsSectionEl,
  section3El,
  sectionAfterS3El,
  floatingPersonaEl,
  section3PersonaImg,
  onFirstSectionToneChange,
  exhibitionsLabelEl,
  exhibitionsAnchorStartEl,
  exhibitionsAnchorEndRef,
  sankeySectionEl,
  clusterSectionEl,
}) {
  if (!section1El || !section2El) return null;

  const personaIcon = actorsSectionEl?.querySelector(
    '[data-actor="persona"] .actors-preview__icon',
  );

  const personaPos = measurePersonaPositions(
    actorsSectionEl,
    section3El,
    personaIcon,
    section3PersonaImg,
  );

  const smoother = ScrollSmoother.create({
    wrapper: SMOOTH_WRAPPER_ID,
    content: SMOOTH_CONTENT_ID,
    smooth: 1.5,
    effects: true,
  });

  setupIntroBridge(section1El, onFirstSectionToneChange);
  setupIdentitySectionTimeline(section2El);

  if (actorsSectionEl && section3El && sectionAfterS3El) {
    if (personaPos && floatingPersonaEl && section3PersonaImg) {
      setupActorsToPersonaGrow({
        actorsEl: actorsSectionEl,
        s3El: section3El,
        sectionAfterS3El,
        floatingEl: floatingPersonaEl,
        s3PersonaImg: section3PersonaImg,
        personaPos,
      });
    } else {
      setupSection3PinCoverFallback(section3El, sectionAfterS3El);
    }
  }

  setupExhibitionsLabel({
    labelEl: exhibitionsLabelEl,
    startAnchorEl: exhibitionsAnchorStartEl,
    endAnchorEl: exhibitionsAnchorEndRef,
    timelineSectionEl: sectionAfterS3El,
    sankeySectionEl,
  });

  setupSankeyToClusterDotTravel({
    sankeySectionEl,
    clusterSectionEl,
  });

  return smoother;
}

export function destroyAppScrollAnimations(smoother) {
  ScrollTrigger.getAll().forEach((t) => t.kill());
  smoother?.kill();
}
