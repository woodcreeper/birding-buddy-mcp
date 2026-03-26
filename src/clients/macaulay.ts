const MACAULAY_BASE = "https://search.macaulaylibrary.org/api/v1/search";

export interface MediaCounts {
  photo: number;
  audio: number;
  video: number;
  total: number;
}

export async function getMediaCounts(
  taxonCode: string,
  regionCode?: string
): Promise<MediaCounts> {
  const counts: MediaCounts = { photo: 0, audio: 0, video: 0, total: 0 };

  for (const mediaType of ["photo", "audio", "video"] as const) {
    const params = new URLSearchParams({
      taxonCode,
      mediaType,
      count: "1",
    });
    if (regionCode) {
      params.set("regionCode", regionCode);
    }

    try {
      const response = await fetch(`${MACAULAY_BASE}?${params}`);
      if (!response.ok) continue;

      const data = await response.json() as { results: { count: number } };
      const count = data.results?.count ?? 0;
      counts[mediaType] = count;
      counts.total += count;
    } catch {
      // Macaulay API is undocumented — silently continue on failure
    }
  }

  return counts;
}
