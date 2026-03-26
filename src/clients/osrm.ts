const OSRM_BASE = "https://router.project-osrm.org/route/v1/driving";

export interface RouteGeometry {
  coordinates: [number, number][]; // [lng, lat] pairs
  totalDistanceKm: number;
  totalDurationMin: number;
}

export async function getRoute(
  startLng: number, startLat: number,
  endLng: number, endLat: number
): Promise<RouteGeometry> {
  const url = `${OSRM_BASE}/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`OSRM error ${response.status}: ${await response.text()}`);
  }

  const data = await response.json() as {
    code: string;
    routes: Array<{
      geometry: { coordinates: [number, number][] };
      distance: number;
      duration: number;
    }>;
  };

  if (data.code !== "Ok" || !data.routes.length) {
    throw new Error(`OSRM returned no routes: ${data.code}`);
  }

  const route = data.routes[0];
  return {
    coordinates: route.geometry.coordinates,
    totalDistanceKm: route.distance / 1000,
    totalDurationMin: route.duration / 60,
  };
}
