const XC_BASE = "https://xeno-canto.org/api/2/recordings";

export interface XenoCantoResult {
  numRecordings: number;
  numSpecies: number;
}

export async function getRecordingCount(
  scientificName: string,
  country?: string
): Promise<number> {
  let query = scientificName;
  if (country) {
    query += ` cnt:${country}`;
  }

  const url = `${XC_BASE}?query=${encodeURIComponent(query)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Xeno-canto error ${response.status}: ${await response.text()}`);
  }

  const data = await response.json() as { numRecordings: string };
  return parseInt(data.numRecordings, 10) || 0;
}
