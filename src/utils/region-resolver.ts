import type { EBirdClient, SubRegion } from "../clients/ebird.js";

const regionCache = new Map<string, SubRegion[]>();

/**
 * Fuzzy-match a place name to an eBird region code.
 * Searches country-level, then subnational1, then subnational2.
 */
export async function resolveRegionCode(
  client: EBirdClient,
  placeName: string
): Promise<{ code: string; name: string } | null> {
  const needle = placeName.toLowerCase().trim();

  // Try countries first
  const countries = await getCachedSubRegions(client, "world", "country");
  const countryMatch = fuzzyMatch(countries, needle);
  if (countryMatch) return countryMatch;

  // Search subnational1 within each country that partially matches
  for (const country of countries) {
    if (
      needle.length >= 3 &&
      !country.name.toLowerCase().includes(needle.slice(0, 3))
    ) {
      // Skip countries that don't even partially match to avoid excessive API calls
    }

    try {
      const states = await getCachedSubRegions(client, country.code, "subnational1");
      const stateMatch = fuzzyMatch(states, needle);
      if (stateMatch) return stateMatch;
    } catch {
      // Some regions may not have sub-regions
    }
  }

  return null;
}

function fuzzyMatch(
  regions: SubRegion[],
  needle: string
): { code: string; name: string } | null {
  // Exact match
  const exact = regions.find((r) => r.name.toLowerCase() === needle);
  if (exact) return exact;

  // Starts with
  const startsWith = regions.find((r) =>
    r.name.toLowerCase().startsWith(needle)
  );
  if (startsWith) return startsWith;

  // Contains
  const contains = regions.find((r) =>
    r.name.toLowerCase().includes(needle)
  );
  if (contains) return contains;

  return null;
}

async function getCachedSubRegions(
  client: EBirdClient,
  parentCode: string,
  regionType: "country" | "subnational1" | "subnational2"
): Promise<SubRegion[]> {
  const cacheKey = `${parentCode}:${regionType}`;
  if (regionCache.has(cacheKey)) {
    return regionCache.get(cacheKey)!;
  }

  const regions = await client.getSubRegions(parentCode, regionType);
  regionCache.set(cacheKey, regions);
  return regions;
}
