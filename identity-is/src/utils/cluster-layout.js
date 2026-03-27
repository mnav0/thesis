/**
 * Dynamic cluster radius scaling using exponential falloff.
 * Returns a radius in [minRadius, maxRadius] based on item count.
 */
export function computeClusterRadius(n) {
  const minRadius = 40;
  const maxRadius = 140;
  if (n <= 1) return minRadius;
  const k = 0.25;
  return Math.round(
    minRadius + (maxRadius - minRadius) * (1 - Math.exp(-k * (n - 1))),
  );
}

/**
 * Returns a CSS position style ({ left, top }) for artwork `idx` out of `total`
 * items, distributing them within a circular area of `containerSize` px.
 * Uses seeded randomness so the layout is stable across re-renders.
 */
export function getClusterStyle(idx, total, containerSize = 280) {
  const centerX = containerSize / 2;
  const centerY = containerSize / 2;
  const imgHalf = 40; // half of 80px artwork thumbnail
  const radius = containerSize / 2 - imgHalf;

  if (total === 1) {
    return {
      left: `${centerX - imgHalf}px`,
      top: `${centerY - imgHalf}px`,
    };
  }

  function seededRandom(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  const angle = seededRandom(idx * 13 + total * 17) * 2 * Math.PI;
  const r = Math.sqrt(seededRandom(idx * 31 + total * 7)) * radius;
  const x = centerX + Math.cos(angle) * r - imgHalf;
  const y = centerY + Math.sin(angle) * r - imgHalf;

  return {
    left: `${x}px`,
    top: `${y}px`,
  };
}
