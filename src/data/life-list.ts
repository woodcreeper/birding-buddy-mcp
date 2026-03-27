import { parse } from "csv-parse/sync";

export interface LifeListEntry {
  commonName: string;
  scientificName: string;
  firstObsDate: string;
  country: string;
}

export interface LifeListData {
  species: Record<string, LifeListEntry>;
}

export interface LifeListStore {
  save(data: LifeListData): Promise<void>;
  load(): Promise<LifeListData | null>;
}

export function parseCsv(
  csvContent: string
): { species: Record<string, LifeListEntry>; countries: Set<string> } {
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as Record<string, string>[];

  const species: Record<string, LifeListEntry> = {};
  const countries = new Set<string>();

  for (const row of records) {
    const category = row["Category"]?.trim();
    const countable = row["Countable"]?.trim();

    // Only include countable species
    if (category !== "species" || countable !== "1") continue;

    const scientificName = row["Scientific Name"]?.trim();
    const commonName = row["Common Name"]?.trim();
    const dateStr = row["Date"]?.trim();
    const sp = row["S/P"]?.trim(); // State/Province code like "CR-A", "US-NJ", "JP-13"

    if (!scientificName || !commonName) continue;

    // Derive country code from S/P (e.g., "CR-A" → "CR", "US-NJ" → "US")
    const country = sp ? sp.split("-")[0] : "??";
    const firstObsDate = dateStr || "";

    if (!species[scientificName]) {
      species[scientificName] = {
        commonName,
        scientificName,
        firstObsDate,
        country,
      };
      countries.add(country);
    } else if (firstObsDate && species[scientificName].firstObsDate) {
      // Keep the earliest observation date
      const existing = new Date(species[scientificName].firstObsDate);
      const current = new Date(firstObsDate);
      if (!isNaN(current.getTime()) && (isNaN(existing.getTime()) || current < existing)) {
        species[scientificName].firstObsDate = firstObsDate;
        species[scientificName].country = country;
      }
    }
  }

  return { species, countries };
}

export async function importLifeList(
  csvContent: string,
  store: LifeListStore
): Promise<{ totalSpecies: number; countries: number }> {
  const { species, countries } = parseCsv(csvContent);
  const data: LifeListData = { species };
  await store.save(data);

  return {
    totalSpecies: Object.keys(species).length,
    countries: countries.size,
  };
}

export async function checkLifeList(
  name: string,
  store: LifeListStore
): Promise<LifeListEntry | null> {
  const data = await store.load();
  if (!data) return null;
  // Try scientific name key first (fast path)
  if (data.species[name]) return data.species[name];
  // Fall back to case-insensitive common name search
  const lower = name.toLowerCase();
  for (const entry of Object.values(data.species)) {
    if (entry.commonName.toLowerCase() === lower) return entry;
  }
  return null;
}

export async function getLifeListStats(store: LifeListStore): Promise<{
  totalSpecies: number;
  byCountry: Record<string, number>;
  byYear: Record<string, number>;
}> {
  const data = await store.load();
  if (!data) {
    return { totalSpecies: 0, byCountry: {}, byYear: {} };
  }

  const byCountry: Record<string, number> = {};
  const byYear: Record<string, number> = {};

  for (const entry of Object.values(data.species)) {
    byCountry[entry.country] = (byCountry[entry.country] || 0) + 1;

    if (entry.firstObsDate) {
      const parsed = new Date(entry.firstObsDate);
      if (!isNaN(parsed.getTime())) {
        const year = String(parsed.getFullYear());
        byYear[year] = (byYear[year] || 0) + 1;
      }
    }
  }

  return {
    totalSpecies: Object.keys(data.species).length,
    byCountry,
    byYear,
  };
}

export async function isLifeListLoaded(
  store: LifeListStore
): Promise<boolean> {
  const data = await store.load();
  return data !== null && Object.keys(data.species).length > 0;
}

export async function getLifeListNames(
  store: LifeListStore
): Promise<Set<string>> {
  const data = await store.load();
  if (!data) return new Set();
  return new Set(Object.keys(data.species));
}
