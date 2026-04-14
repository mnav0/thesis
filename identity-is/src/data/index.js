import { ref, computed } from "vue";
import { csvParse } from "d3";

import artistsCSV from "./artists.csv?raw";
import institutionsCSV from "./institutions.csv?raw";
import artworksCSV from "./artworks.csv?raw";
import themesCSV from "./themes.csv?raw";
import artistThemesCSV from "./artist_themes.csv?raw";
import institutionThemesCSV from "./institution_themes.csv?raw";

import artistArtistSummary from "./artist_artist_summary.json";
import institutionArtistSummary from "./institution_artist_summary.json";
import artistClusterPositions from "./artist_cluster_positions.json";
import institutionClusterPositions from "./institution_cluster_positions.json";
import exhibitionsData from "./exhibitions_precomputed.json";

// --- Reactive state ---

export const artistsById = ref({});
export const institutionsById = ref({});
export const artworks = ref([]);

// Pre-parsed theme rows (available after module load, no need to re-parse in components)
export const artistThemeRows = csvParse(artistThemesCSV);
export const institutionThemeRows = csvParse(institutionThemesCSV);
export const themeRows = csvParse(themesCSV);
export const themePreviewTitles = computed(() =>
  themeRows.map((row) => row.theme_title).filter(Boolean),
);

/** Precomputed cluster map data for ClusterSection (artist- vs institution-centric summaries + layouts). */
export const artistSummary = artistArtistSummary;
export const institutionSummary = institutionArtistSummary;
export const artistPositions = artistClusterPositions;
export const institutionPositions = institutionClusterPositions;
export const exhibitionsPrecomputedData = exhibitionsData;

export function fetchAndParseData() {
  const artistArr = csvParse(artistsCSV);
  const institutionArr = csvParse(institutionsCSV);
  const artworkArr = csvParse(artworksCSV);

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

  artworks.value = artworkArr.map((a) => ({
    ...a,
    artistName: artistsById.value[a.artist]?.name || a.artist,
    institutionName:
      institutionsById.value[a.institution]?.name || a.institution,
  }));
}
