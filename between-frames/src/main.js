import { createApp, ref, computed } from 'vue';
import App from './App.vue';
import './style.css';
import artistsCSV from './data/artists.csv?raw';
import institutionsCSV from './data/institutions.csv?raw';
import artworksCSV from './data/artworks.csv?raw';
import themesCSV from './data/themes.csv?raw';
import mediumsCSV from './data/mediums.csv?raw';
import artistThemesCSV from './data/artist_themes.csv?raw';
import institutionThemesCSV from './data/institution_themes.csv?raw';


// Robust CSV parser: strips quotes from headers and values
function parseCSV(text) {
	const lines = text.trim().split(/\r?\n/);
	const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ''));
	return lines.slice(1).map((line) => {
		const values = [];
		let current = "";
		let inQuotes = false;
		for (let i = 0; i < line.length; i++) {
			const char = line[i];
			if (char === '"') inQuotes = !inQuotes;
			else if (char === "," && !inQuotes) {
				values.push(current);
				current = "";
			} else current += char;
		}
		values.push(current);
		const cleanedValues = values.map(v => v.trim().replace(/^"|"$/g, ''));
		const obj = {};
		headers.forEach((h, i) => (obj[h] = cleanedValues[i]));
		return obj;
	});
}

export function fetchAndParseData() {
	const artistArr = parseCSV(artistsCSV);
	const institutionArr = parseCSV(institutionsCSV);
	const artworkArr = parseCSV(artworksCSV);
	const themeArr = parseCSV(themesCSV);
	const mediumArr = parseCSV(mediumsCSV);
	const artistThemesArr = parseCSV(artistThemesCSV);
	const institutionThemesArr = parseCSV(institutionThemesCSV);

	// Build lookup maps
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
		})
	);
	themesById.value = Object.fromEntries(themeArr.map((t) => [t.theme_id, t]));
	 mediumsById.value = Object.fromEntries(mediumArr.map((m) => [m.medium_id, m]));

	artworks.value = artworkArr.map((a) => {
		// Parse mediums_parsed as array
		let mediumIds = [];
		// Try JSON.parse first, fallback to regex if it fails
		try {
			mediumIds = JSON.parse(a.mediums_parsed.replace(/'/g, '"'));
		} catch {
			// Fallback: extract IDs like [M01, M02] or ["M01", "M02"]
			const match = a.mediums_parsed.match(/\[([^\]]*)\]/);
			if (match && match[1]) {
				mediumIds = match[1].split(',').map(s => s.replace(/['"\s]/g, ''));
			} else {
				mediumIds = [];
			}
		}
		return {
			...a,
			artistName: artistsById.value[a.artist]?.name || a.artist,
			institutionName: institutionsById.value[a.institution]?.name || a.institution,
			mediumIds,
		};
	});

	// Store theme mappings for clustering
	artistThemesMap.value = {};
	artistThemesArr.forEach((row) => {
		if (!artistThemesMap.value[row.theme_id]) artistThemesMap.value[row.theme_id] = new Set();
		artistThemesMap.value[row.theme_id].add(row.artist);
	});
	institutionThemesMap.value = {};
	institutionThemesArr.forEach((row) => {
		if (!institutionThemesMap.value[row.theme_id]) institutionThemesMap.value[row.theme_id] = new Set();
		institutionThemesMap.value[row.theme_id].add(row.artist);
	});
}

export const artistsById = ref({});
export const institutionsById = ref({});
export const themesById = ref({});
export const mediumsById = ref({});
export const artworks = ref([]);
export const artistThemesMap = ref({}); // theme_id -> Set of artist ids
export const institutionThemesMap = ref({}); // theme_id -> Set of artist ids
export const groupBy = ref("artist"); // or 'institution' or 'theme' or 'medium'

export const groupedArtworks = computed(() => {
 if (groupBy.value === "artist") {
  const groups = {};
  artworks.value.forEach((a) => {
   if (!groups[a.artist])
	groups[a.artist] = { name: a.artistName, items: [] };
   groups[a.artist].items.push(a);
  });
  return Object.values(groups);
 } else if (groupBy.value === "institution") {
  const groups = {};
  artworks.value.forEach((a) => {
   if (!groups[a.institution])
	groups[a.institution] = { name: a.institutionName, items: [] };
   groups[a.institution].items.push(a);
  });
  return Object.values(groups);
 } else if (groupBy.value === "medium") {
  const groups = {};
	artworks.value.forEach((a) => {
		(a.mediumIds || []).forEach((mid) => {
			const m = mediumsById.value[mid];
			// Capitalize first letter of medium title
			let label = m && m.medium_title ? m.medium_title.charAt(0).toUpperCase() + m.medium_title.slice(1) : mid;
			if (!groups[mid])
				groups[mid] = { name: label, items: [] };
			groups[mid].items.push(a);
		});
	});
	return Object.values(groups);
 } else if (groupBy.value === "theme") {
	 // Cluster by theme: for each theme, group all artists linked to that theme (from both artist_themes and institution_themes),
	 // and for each artist, select a random artwork to represent them.
	 const groups = [];
	 const allThemes = Object.keys(themesById.value);
	 for (const themeId of allThemes) {
		 const theme = themesById.value[themeId];
		 // Get all unique artist ids for this theme from both maps
		 const artistSet = new Set();
		 if (artistThemesMap.value[themeId]) {
			 for (const aid of artistThemesMap.value[themeId]) artistSet.add(aid);
		 }
		 if (institutionThemesMap.value[themeId]) {
			 for (const aid of institutionThemesMap.value[themeId]) artistSet.add(aid);
		 }
		 // For each artist, pick a random artwork
		 const items = [];
		 for (const artistId of artistSet) {
			 const artistArtworks = artworks.value.filter(a => a.artist === artistId);
			 if (artistArtworks.length > 0) {
				 // Pick a random artwork for this artist
				 const idx = Math.floor(Math.random() * artistArtworks.length);
				 items.push(artistArtworks[idx]);
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

// Dynamic cluster radius scaling: max 140, min 40, exponential scaling
export function computeClusterRadius(n) {
	const minRadius = 40; // for 1 item
	const maxRadius = 140; // for large clusters
	if (n <= 1) return minRadius;
	// Exponential scaling for overlap: adjust k for curve steepness
	const k = 0.25;
	return Math.round(minRadius + (maxRadius - minRadius) * (1 - Math.exp(-k * (n - 1))));
}

// Returns a style object for each artwork in a cluster, distributing them throughout the circle area
// Returns a style object for each artwork in a cluster, distributing them throughout the circle area
// Accepts an optional radius argument for dynamic scaling
export function getClusterStyle(idx, total, containerSize = 280) {
	// containerSize is the width/height of the cluster-container (px)
	const centerX = containerSize / 2, centerY = containerSize / 2;
	// The radius for placing items should fill the container, minus image size
	const imgHalf = 40; // 80px image
	const radius = (containerSize / 2) - imgHalf;
	if (total === 1) {
		// Place single artwork at the center
		return {
			left: `${centerX - imgHalf}px`,
			top: `${centerY - imgHalf}px`,
		};
	}
	// Use a seeded random for stable layout
	function seededRandom(seed) {
		let x = Math.sin(seed) * 10000;
		return x - Math.floor(x);
	}
	// Generate random radius and angle for each artwork
	const angle = seededRandom(idx * 13 + total * 17) * 2 * Math.PI;
	// sqrt for uniform distribution in circle
	const r = Math.sqrt(seededRandom(idx * 31 + total * 7)) * radius;
	const x = centerX + Math.cos(angle) * r - imgHalf;
	const y = centerY + Math.sin(angle) * r - imgHalf;
	return {
		left: `${x}px`,
		top: `${y}px`,
	};
}

createApp(App).mount('#app');
