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
