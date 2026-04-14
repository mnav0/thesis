/** Resolve a path under `public/` for the current Vite `base` (e.g. GitHub Pages). */
export function publicImgSrc(path) {
  const normalized = path.replace(/^\//, "");
  return `${import.meta.env.BASE_URL}${normalized}`;
}
