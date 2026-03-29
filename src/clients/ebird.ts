const EBIRD_API_BASE = "https://api.ebird.org/v2";

export interface Observation {
  speciesCode: string;
  comName: string;
  sciName: string;
  locId: string;
  locName: string;
  obsDt: string;
  howMany?: number;
  lat: number;
  lng: number;
  obsValid: boolean;
  obsReviewed: boolean;
  locationPrivate: boolean;
  subId: string;
  exoticCategory?: "N" | "P" | "X"; // N=Naturalized, P=Provisional, X=Escapee; absent=native
}

export interface Hotspot {
  locId: string;
  locName: string;
  countryCode: string;
  subnational1Code: string;
  subnational2Code?: string;
  lat: number;
  lng: number;
  latestObsDt?: string;
  numSpeciesAllTime?: number;
}

export interface TaxonomyEntry {
  sciName: string;
  comName: string;
  speciesCode: string;
  category: string;
  taxonOrder: number;
  bandingCodes?: string[];
  comNameCodes?: string[];
  sciNameCodes?: string[];
  order: string;
  familyComName: string;
  familySciName: string;
}

export interface RegionInfo {
  result: string;
  code: string;
  type: string;
  longitude?: number;
  latitude?: number;
  bounds?: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
}

export interface SubRegion {
  code: string;
  name: string;
}

export interface ChecklistFeedEntry {
  locId: string;
  subId: string;
  userDisplayName: string;
  numSpecies: number;
  obsDt: string;
  obsTime?: string;
  isoObsDt?: string;
  subID: string;
  loc: {
    locId: string;
    name: string;
    latitude: number;
    longitude: number;
    countryCode: string;
    countryName: string;
    subnational1Name: string;
    subnational1Code: string;
  };
}

export interface ChecklistViewObs {
  speciesCode: string;
  obsDt: string;
  howManyStr?: string;
  obsComments?: string;
}

export interface ChecklistView {
  subId: string;
  protocolId: string;
  locId: string;
  loc?: {
    locId: string;
    name: string;
    latitude: number;
    longitude: number;
    countryCode: string;
    countryName: string;
    subnational1Name: string;
    subnational1Code: string;
    isHotspot: boolean;
  };
  obsDt: string;
  obsTimeValid: boolean;
  subComments?: string;
  creationDt: string;
  userDisplayName: string;
  numSpecies: number;
  numObservers?: number;
  durationHrs?: number;
  effortDistanceKm?: number;
  obs: ChecklistViewObs[];
}

export interface RegionalStats {
  numChecklists: number;
  numContributors: number;
  numSpecies: number;
}

export class EBirdClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request<T>(path: string, params: Record<string, string | number | boolean | undefined> = {}): Promise<T> {
    const url = new URL(`${EBIRD_API_BASE}${path}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }

    const response = await fetch(url.toString(), {
      headers: { "X-eBirdApiToken": this.apiKey },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`eBird API error ${response.status}: ${text}`);
    }

    return response.json() as Promise<T>;
  }

  // --- Observations ---

  async getRecentObservations(regionCode: string, opts: {
    back?: number; maxResults?: number; hotspot?: boolean;
  } = {}): Promise<Observation[]> {
    return this.request<Observation[]>(`/data/obs/${regionCode}/recent`, opts);
  }

  async getNotableObservations(regionCode: string, opts: {
    back?: number; maxResults?: number; hotspot?: boolean;
  } = {}): Promise<Observation[]> {
    return this.request<Observation[]>(`/data/obs/${regionCode}/recent/notable`, opts);
  }

  async getNearbyObservations(lat: number, lng: number, opts: {
    dist?: number; back?: number; maxResults?: number; hotspot?: boolean;
  } = {}): Promise<Observation[]> {
    return this.request<Observation[]>(`/data/obs/geo/recent`, { lat, lng, ...opts });
  }

  async getNearbyNotableObservations(lat: number, lng: number, opts: {
    dist?: number; back?: number; maxResults?: number;
  } = {}): Promise<Observation[]> {
    return this.request<Observation[]>(`/data/obs/geo/recent/notable`, { lat, lng, ...opts });
  }

  async getObservationsForSpecies(regionCode: string, speciesCode: string, opts: {
    back?: number; maxResults?: number; hotspot?: boolean;
  } = {}): Promise<Observation[]> {
    return this.request<Observation[]>(`/data/obs/${regionCode}/recent/${speciesCode}`, opts);
  }

  async getNearestObservationsForSpecies(speciesCode: string, lat: number, lng: number, opts: {
    dist?: number; back?: number; maxResults?: number;
  } = {}): Promise<Observation[]> {
    return this.request<Observation[]>(`/data/nearest/geo/recent/${speciesCode}`, { lat, lng, ...opts });
  }

  async getHistoricObservations(regionCode: string, year: number, month: number, day: number, opts: {
    maxResults?: number; detail?: "simple" | "full";
  } = {}): Promise<Observation[]> {
    return this.request<Observation[]>(
      `/data/obs/${regionCode}/historic/${year}/${month}/${day}`,
      opts
    );
  }

  // --- Hotspots ---

  async getHotspotsInRegion(regionCode: string, opts: {
    back?: number; fmt?: string;
  } = {}): Promise<Hotspot[]> {
    return this.request<Hotspot[]>(`/ref/hotspot/${regionCode}`, { ...opts, fmt: "json" });
  }

  async getNearbyHotspots(lat: number, lng: number, opts: {
    dist?: number; back?: number;
  } = {}): Promise<Hotspot[]> {
    return this.request<Hotspot[]>(`/ref/hotspot/geo`, { lat, lng, ...opts, fmt: "json" });
  }

  async getHotspotInfo(locId: string): Promise<Hotspot> {
    return this.request<Hotspot>(`/ref/hotspot/info/${locId}`);
  }

  // --- Taxonomy ---

  async getTaxonomy(opts: {
    species?: string; locale?: string; cat?: string;
  } = {}): Promise<TaxonomyEntry[]> {
    return this.request<TaxonomyEntry[]>(`/ref/taxonomy/ebird`, { fmt: "json", ...opts });
  }

  async getSpeciesList(regionCode: string): Promise<string[]> {
    return this.request<string[]>(`/product/spplist/${regionCode}`);
  }

  // --- Reference ---

  async getRegionInfo(regionCode: string): Promise<RegionInfo> {
    return this.request<RegionInfo>(`/ref/region/info/${regionCode}`, { fmt: "json" });
  }

  async getSubRegions(regionCode: string, regionType: "country" | "subnational1" | "subnational2"): Promise<SubRegion[]> {
    return this.request<SubRegion[]>(`/ref/region/list/${regionType}/${regionCode}`);
  }

  // --- Products ---

  async getChecklistFeed(regionCode: string, opts: {
    maxResults?: number;
  } = {}): Promise<ChecklistFeedEntry[]> {
    return this.request<ChecklistFeedEntry[]>(`/product/lists/${regionCode}`, opts);
  }

  async getChecklistView(subId: string): Promise<ChecklistView> {
    return this.request<ChecklistView>(`/product/checklist/view/${subId}`);
  }

  async getRegionalStats(regionCode: string, year: number, month: number, day: number): Promise<RegionalStats> {
    return this.request<RegionalStats>(
      `/product/stats/${regionCode}/${year}/${month}/${day}`
    );
  }
}
