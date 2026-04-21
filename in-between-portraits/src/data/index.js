import { ref, computed } from "vue";
import { csvParse } from "d3";

import artistsCSV from "./artists.csv?raw";
import institutionsCSV from "./institutions.csv?raw";
import artworksCSV from "./artworks.csv?raw";
import themesCSV from "./themes.csv?raw";
import artistThemesCSV from "./artist_themes.csv?raw";
import institutionThemesCSV from "./institution_themes.csv?raw";
import artistWordsCSV from "./artist_words.csv?raw";
import institutionWordsCSV from "./institution_words.csv?raw";
import exhibitionsCSV from "./exhibitions.csv?raw";
import artistPointsJSON from "../../artist_points.json";

import artistClusters from "./clusters/artist_clusters.json";
import institutionClusters from "./clusters/institution_clusters.json";
import artistClusterPositions from "./clusters/artist_cluster_positions.json";
import institutionClusterPositions from "./clusters/institution_cluster_positions.json";
import exhibitionClusters from "./clusters/exhibition_clusters.json";

// --- Derived constants ---

const _parsedArtists = csvParse(artistsCSV);
export const artistCount = _parsedArtists.length;
export const exhibitionEntryCount = csvParse(exhibitionsCSV).length;

// --- Reactive state ---

export const artistsById = ref({});
export const institutionsById = ref({});
export const artworks = ref([]);

// Pre-parsed theme rows (available after module load, no need to re-parse in components)
export const artistThemeRows = csvParse(artistThemesCSV);
export const institutionThemeRows = csvParse(institutionThemesCSV);
export const themeRows = csvParse(themesCSV);
export const artistWordRows = csvParse(artistWordsCSV);
export const institutionWordRows = csvParse(institutionWordsCSV);
export const artistPointsRows = artistPointsJSON;
export const themePreviewTitles = computed(() =>
  themeRows.map((row) => row.theme_title).filter(Boolean),
);

/** Precomputed cluster map data for ClusterSection (artist- vs institution-centric summaries + layouts). */
export const artistClustersMap = artistClusters;
export const institutionClustersMap = institutionClusters;
export const artistPositionsMap = artistClusterPositions;
export const institutionPositionsMap = institutionClusterPositions;
export const exhibitionClustersMap = exhibitionClusters;

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
