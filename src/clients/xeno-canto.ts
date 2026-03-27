const XC_BASE = "https://xeno-canto.org/api/3/recordings";

interface XCRecording {
  q: string; // quality grade: A, B, C, D, E
}

interface XCResponse {
  numRecordings: string;
  numSpecies: string;
  page: number;
  numPages: number;
  recordings: XCRecording[];
}

export interface RecordingCounts {
  total: number;
  grades: { A: number; B: number; C: number; D: number; E: number };
  species: string;
  country?: string;
}

/**
 * Get recording counts broken down by quality grade for a species.
 * Pages through all results when numPages > 1.
 */
export async function getRecordingCounts(
  apiKey: string,
  speciesName: string,
  country?: string
): Promise<RecordingCounts> {
  let query = speciesName;
  if (country) {
    query += ` cnt:"${country}"`;
  }

  const grades = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  let total = 0;
  let page = 1;
  let numPages = 1;

  do {
    const params = new URLSearchParams({
      query,
      key: apiKey,
      per_page: "500",
      page: String(page),
    });

    const response = await fetch(`${XC_BASE}?${params}`);

    if (!response.ok) {
      throw new Error(
        `Xeno-canto error ${response.status}: ${await response.text()}`
      );
    }

    const data = (await response.json()) as XCResponse;
    numPages = data.numPages;

    for (const recording of data.recordings) {
      const grade = recording.q as keyof typeof grades;
      if (grade in grades) {
        grades[grade]++;
      }
      total++;
    }

    page++;
  } while (page <= numPages);

  return { total, grades, species: speciesName, country };
}
