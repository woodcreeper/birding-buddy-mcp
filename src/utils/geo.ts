const EARTH_RADIUS_KM = 6371;

/** Haversine distance in km between two lat/lng points */
export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Sample waypoints along a route at given interval.
 * Coordinates are [lng, lat] pairs (GeoJSON order).
 * Returns [lat, lng] pairs (eBird order).
 */
export function sampleWaypoints(
  coordinates: [number, number][],
  intervalKm: number
): [number, number][] {
  if (coordinates.length === 0) return [];

  const waypoints: [number, number][] = [];
  let distSinceLastWaypoint = intervalKm; // Force first point to be a waypoint

  for (let i = 0; i < coordinates.length; i++) {
    const [lng, lat] = coordinates[i];

    if (i === 0) {
      waypoints.push([lat, lng]);
      distSinceLastWaypoint = 0;
      continue;
    }

    const [prevLng, prevLat] = coordinates[i - 1];
    const segmentDist = haversineDistance(prevLat, prevLng, lat, lng);
    distSinceLastWaypoint += segmentDist;

    if (distSinceLastWaypoint >= intervalKm) {
      waypoints.push([lat, lng]);
      distSinceLastWaypoint = 0;
    }
  }

  // Include endpoint if final segment < 10km from last waypoint
  const lastCoord = coordinates[coordinates.length - 1];
  const lastWaypoint = waypoints[waypoints.length - 1];
  if (lastWaypoint) {
    const distToEnd = haversineDistance(
      lastWaypoint[0], lastWaypoint[1],
      lastCoord[1], lastCoord[0]
    );
    if (distToEnd >= 1) {
      waypoints.push([lastCoord[1], lastCoord[0]]);
    }
  }

  return waypoints;
}

/**
 * Sample straight-line waypoints between two points (fallback when OSRM unavailable).
 * Returns [lat, lng] pairs.
 */
export function sampleStraightLine(
  startLat: number, startLng: number,
  endLat: number, endLng: number,
  intervalKm: number
): [number, number][] {
  const totalDist = haversineDistance(startLat, startLng, endLat, endLng);
  const numPoints = Math.max(2, Math.ceil(totalDist / intervalKm) + 1);
  const waypoints: [number, number][] = [];

  for (let i = 0; i < numPoints; i++) {
    const t = i / (numPoints - 1);
    const lat = startLat + t * (endLat - startLat);
    const lng = startLng + t * (endLng - startLng);
    waypoints.push([lat, lng]);
  }

  return waypoints;
}
