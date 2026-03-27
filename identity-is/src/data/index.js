import { ref, computed } from "vue";
import { parseCSV } from "../utils/csv.js";

import artistsCSV from "./artists.csv?raw";
import institutionsCSV from "./institutions.csv?raw";
import artworksCSV from "./artworks.csv?raw";
import themesCSV from "./themes.csv?raw";
import mediumsCSV from "./mediums.csv?raw";
import artistThemesCSV from "./artist_themes.csv?raw";
import institutionThemesCSV from "./institution_themes.csv?raw";

// --- Reactive state ---

export const artistsById = ref({});
export const institutionsById = ref({});
export const themesById = ref({});
export const mediumsById = ref({});
export const artworks = ref([]);
export const artistThemesMap = ref({}); // theme_id -> Set of artist ids
export const institutionThemesMap = ref({}); // theme_id -> Set of artist ids
export const groupBy = ref("theme");

// Pre-parsed theme rows (available after module load, no need to re-parse in components)
export const artistThemeRows = parseCSV(artistThemesCSV);
export const institutionThemeRows = parseCSV(institutionThemesCSV);
export const themeRows = parseCSV(themesCSV);
export const themePreviewTitles = computed(() =>
  themeRows.map((row) => row.theme_title).filter(Boolean),
);

export function fetchAndParseData() {
  const artistArr = parseCSV(artistsCSV);
  const institutionArr = parseCSV(institutionsCSV);
  const artworkArr = parseCSV(artworksCSV);
  const themeArr = parseCSV(themesCSV);
  const mediumArr = parseCSV(mediumsCSV);

  artistsById.value = Object.fromEntries(artistArr.map((a) => [a.id, a]));

  institutionsById.value = Object.fromEntries(
    institutionArr.map((i) => {
      let artistIds = [];
      try {
        artistIds = JSON.parse(i.artists.replace(/'/g, '"'));
      } catch {
        artistIds = [];
      }
      return [i.id, { ...i, artistIds }];
    }),
  );

  themesById.value = Object.fromEntries(
    themeArr.map((t) => [t.theme_id, t]),
  );
  mediumsById.value = Object.fromEntries(
    mediumArr.map((m) => [m.medium_id, m]),
  );

  artworks.value = artworkArr.map((a) => {
    let mediumIds = [];
    try {
      mediumIds = JSON.parse(a.mediums_parsed.replace(/'/g, '"'));
    } catch {
      const match = a.mediums_parsed.match(/\[([^\]]*)\]/);
      if (match && match[1]) {
        mediumIds = match[1].split(",").map((s) => s.replace(/['"\s]/g, ""));
      }
    }
    return {
      ...a,
      artistName: artistsById.value[a.artist]?.name || a.artist,
      institutionName:
        institutionsById.value[a.institution]?.name || a.institution,
      mediumIds,
    };
  });

  // Build theme -> artist-set maps for clustering
  const atMap = {};
  artistThemeRows.forEach((row) => {
    if (!atMap[row.theme_id]) atMap[row.theme_id] = new Set();
    atMap[row.theme_id].add(row.artist);
  });
  artistThemesMap.value = atMap;

  const itMap = {};
  institutionThemeRows.forEach((row) => {
    if (!itMap[row.theme_id]) itMap[row.theme_id] = new Set();
    itMap[row.theme_id].add(row.artist);
  });
  institutionThemesMap.value = itMap;
}

// --- Grouped artworks computed ---

function groupByKey(keyField, nameField) {
  const groups = {};
  artworks.value.forEach((a) => {
    const key = a[keyField];
    if (!groups[key]) groups[key] = { name: a[nameField], items: [] };
    groups[key].items.push(a);
  });
  return Object.values(groups);
}

export const groupedArtworks = computed(() => {
  if (groupBy.value === "artist") {
    return groupByKey("artist", "artistName");
  }

  if (groupBy.value === "institution") {
    return groupByKey("institution", "institutionName");
  }

  if (groupBy.value === "medium") {
    const groups = {};
    artworks.value.forEach((a) => {
      (a.mediumIds || []).forEach((mid) => {
        const m = mediumsById.value[mid];
        const label =
          m && m.medium_title
            ? m.medium_title.charAt(0).toUpperCase() + m.medium_title.slice(1)
            : mid;
        if (!groups[mid]) groups[mid] = { name: label, items: [] };
        groups[mid].items.push(a);
      });
    });
    return Object.values(groups);
  }

  if (groupBy.value === "theme") {
    const groups = [];
    for (const themeId of Object.keys(themesById.value)) {
      const theme = themesById.value[themeId];
      const artistSet = new Set();
      if (artistThemesMap.value[themeId]) {
        for (const aid of artistThemesMap.value[themeId]) artistSet.add(aid);
      }
      if (institutionThemesMap.value[themeId]) {
        for (const aid of institutionThemesMap.value[themeId]) artistSet.add(aid);
      }

      const items = [];
      for (const artistId of artistSet) {
        const artistArtworks = artworks.value.filter(
          (a) => a.artist === artistId,
        );
        if (artistArtworks.length > 0) {
          const randomIdx = Math.floor(Math.random() * artistArtworks.length);
          items.push(artistArtworks[randomIdx]);
        }
      }
      if (items.length > 0) {
        groups.push({ name: theme.theme_title, items });
      }
    }
    return groups;
  }

  return [];
});
