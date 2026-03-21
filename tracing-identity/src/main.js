
import { createApp, ref, computed } from 'vue';
import App from './App.vue';
import './style.css';

// Utility to parse CSV (simple, not handling quoted commas)
function parseCSV(text) {
	const lines = text.trim().split(/\r?\n/);
	const headers = lines[0].split(",");
	return lines.slice(1).map((line) => {
		// Handle quoted fields and commas
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
		const obj = {};
		headers.forEach((h, i) => (obj[h.trim()] = values[i]?.trim()));
		return obj;
	});
}

export const artistsById = ref({});
export const institutionsById = ref({});
export const artworks = ref([]);
export const groupBy = ref("artist"); // or 'institution'

export async function fetchAndParseAll() {
	// Fetch all CSVs
	const [artistsText, institutionsText, artworksText] = await Promise.all([
		fetch("/data/artists.csv").then((r) => r.text()),
		fetch("/data/institutions.csv").then((r) => r.text()),
		fetch("/data/artworks.csv").then((r) => r.text()),
	]);
	// Parse
	const artistArr = parseCSV(artistsText);
	const institutionArr = parseCSV(institutionsText);
	const artworkArr = parseCSV(artworksText);

	// Build lookup maps
	artistsById.value = Object.fromEntries(artistArr.map((a) => [a.id, a]));
	institutionsById.value = Object.fromEntries(
		institutionArr.map((i) => {
			// Parse artists field as array
			let artistIds = [];
			try {
				artistIds = JSON.parse(i.artists.replace(/'/g, '"'));
			} catch {
				artistIds = [];
			}
			return [i.id, { ...i, artistIds }];
		}),
	);

	// Parse artworks, resolve artist/institution names
	artworks.value = artworkArr.map((a) => ({
		...a,
		artistName: artistsById.value[a.artist]?.name || a.artist,
		institutionName:
			institutionsById.value[a.institution]?.name || a.institution,
	}));
}

export const groupedArtworks = computed(() => {
	if (groupBy.value === "artist") {
		// Group by artist
		const groups = {};
		artworks.value.forEach((a) => {
			if (!groups[a.artist])
				groups[a.artist] = { name: a.artistName, items: [] };
			groups[a.artist].items.push(a);
		});
		return Object.values(groups);
	} else {
		// Group by institution
		const groups = {};
		artworks.value.forEach((a) => {
			if (!groups[a.institution])
				groups[a.institution] = { name: a.institutionName, items: [] };
			groups[a.institution].items.push(a);
		});
		return Object.values(groups);
	}
});

// Returns a style object for each artwork in a cluster, distributing them throughout the circle area
export function getClusterStyle(idx, total) {
	// Center of the cluster
	const centerX = 180, centerY = 180, radius = 140;
	if (total === 1) {
		// Place single artwork at the center
		return {
			left: `${centerX - 40}px`, // 40 = half img width
			top: `${centerY - 40}px`,
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
	const x = centerX + Math.cos(angle) * r - 40; // 40 = half img width
	const y = centerY + Math.sin(angle) * r - 40;
	return {
		left: `${x}px`,
		top: `${y}px`,
	};
}

createApp(App).mount('#app');
