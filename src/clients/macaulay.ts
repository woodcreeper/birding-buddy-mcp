const MACAULAY_BASE = "https://search.macaulaylibrary.org/api/v1/search";

export interface MediaCounts {
  photo: number;
  audio: number;
  video: number;
  total: number;
}

export interface MacaulayFilters {
  age?: string;
  sex?: string;
  tag?: string;
  qualityAbove?: number;
}

export async function getMediaCounts(
  taxonCode: string,
  regionCode?: string,
  filters?: MacaulayFilters
): Promise<MediaCounts> {
  const counts: MediaCounts = { photo: 0, audio: 0, video: 0, total: 0 };

  for (const mediaType of ["photo", "audio", "video"] as const) {
    const params = new URLSearchParams({
      taxonCode,
      mediaType,
      count: "100",
    });
    if (regionCode) {
      params.set("regionCode", regionCode);
    }
    if (filters?.age) {
      params.set("age", filters.age);
    }
    if (filters?.sex) {
      params.set("sex", filters.sex);
    }
    if (filters?.tag) {
      params.set("tag", filters.tag);
    }
    if (filters?.qualityAbove !== undefined) {
      params.set("qua", String(filters.qualityAbove));
    }

    try {
      const response = await fetch(`${MACAULAY_BASE}?${params}`);
      if (!response.ok) continue;

      const data = await response.json() as { results: { content?: unknown[] } };
      const count = data.results?.content?.length ?? 0;
      counts[mediaType] = count;
      counts.total += count;
    } catch {
      // Macaulay API is undocumented — silently continue on failure
    }
  }

  return counts;
}
