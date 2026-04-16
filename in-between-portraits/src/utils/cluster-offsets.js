/**
 * Computes a { dx, dy } offset for item `index` out of `total` items
 * within a circular cluster of the given `radius`.
 *
 * Small groups (n <= 8) are placed in a ring; larger groups use a
 * spiral with slight randomisation so items don't stack.
 */
export function computeClusterOffset(index, total, radius) {
  if (total === 1) return { dx: 0, dy: 0 };

  if (total <= 8) {
    const angle = (2 * Math.PI * index) / total;
    return {
      dx: Math.cos(angle) * radius,
      dy: Math.sin(angle) * radius,
    };
  }

  const angle = (2 * Math.PI * index) / total + index * 0.5;
  const r = radius * (0.5 + 0.5 * (index / total));
  return {
    dx: Math.cos(angle) * r + (Math.random() - 0.5) * 4,
    dy: Math.sin(angle) * r + (Math.random() - 0.5) * 4,
  };
}

const GROUP_ANCHORS = {
  1: [{ cx: 50, cy: 50 }],
  3: [
    { cx: 25, cy: 30 },
    { cx: 65, cy: 60 },
    { cx: 35, cy: 80 },
  ],
  5: [
    { cx: 20, cy: 20 },
    { cx: 75, cy: 18 },
    { cx: 48, cy: 50 },
    { cx: 20, cy: 78 },
    { cx: 78, cy: 75 },
  ],
};
const dotPositionCache = new Map();

/**
 * Generates random dot positions for `count` dots arranged into
 * `groups` (1, 3, or 5) vague clusters.
 * Uses Math.random() and caches results by args so layouts stay stable
 * during normal reactive re-renders.
 */
export function generateDotPositions(count, groups, variantKey = "default", spread = 12) {
  const cacheKey = `${count}|${groups}|${variantKey}|${spread}`;
  if (dotPositionCache.has(cacheKey)) return dotPositionCache.get(cacheKey);
  const anchors = GROUP_ANCHORS[groups] || GROUP_ANCHORS[1];
  const out = [];

  for (let i = 0; i < count; i++) {
    const anchor = anchors[i % anchors.length];
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * spread;
    const left = Math.min(95, Math.max(5, anchor.cx + Math.cos(angle) * r));
    const top = Math.min(95, Math.max(5, anchor.cy + Math.sin(angle) * r));
    out.push({ left: `${left}%`, top: `${top}%` });
  }

  dotPositionCache.set(cacheKey, out);
  return out;
}
