import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { EBirdClient, Observation, Hotspot } from "../clients/ebird.js";
import type { LifeListStore } from "../data/life-list.js";
import { getLifeListNames } from "../data/life-list.js";
import { getRoute } from "../clients/osrm.js";
import { sampleWaypoints, sampleStraightLine } from "../utils/geo.js";

export function registerCompoundTools(server: McpServer, client: EBirdClient, store: LifeListStore) {
  server.tool(
    "get_life_list_gaps_nearby",
    "Find birds near you that you've NEVER seen — your potential lifers! Requires life list to be imported first.",
    {
      lat: z.number().describe("Your latitude"),
      lng: z.number().describe("Your longitude"),
      dist: z.number().min(0).max(50).optional().describe("Search radius in km (0-50, default 25)"),
      back: z.number().min(1).max(30).optional().describe("Days back (1-30, default 14)"),
    },
    async ({ lat, lng, dist, back }) => {
      const [observations, lifeListNames] = await Promise.all([
        client.getNearbyObservations(lat, lng, { dist, back }),
        getLifeListNames(store),
      ]);

      if (lifeListNames.size === 0) {
        return {
          content: [{ type: "text", text: "No life list loaded. Visit this server's /upload page in your browser to upload your eBird CSV directly." }],
        };
      }

      // Group by species, filter to lifers, count reports
      const speciesMap = new Map<string, { obs: Observation; count: number }>();
      for (const obs of observations) {
        if (lifeListNames.has(obs.sciName)) continue; // Already on life list
        const existing = speciesMap.get(obs.sciName);
        if (existing) {
          existing.count++;
        } else {
          speciesMap.set(obs.sciName, { obs, count: 1 });
        }
      }

      const lifers = Array.from(speciesMap.values())
        .sort((a, b) => b.count - a.count);

      if (lifers.length === 0) {
        return {
          content: [{ type: "text", text: "No potential lifers found nearby — you've seen everything being reported! Try expanding the search radius or days back." }],
        };
      }

      const text = lifers
        .map(
          ({ obs, count }) =>
            `★ ${obs.comName} (${obs.sciName}) [${obs.speciesCode}] — ${count} report(s), nearest at ${obs.locName}`
        )
        .join("\n");

      return {
        content: [{ type: "text", text: `${lifers.length} potential lifers nearby:\n\n${text}` }],
      };
    }
  );

  server.tool(
    "get_life_list_gaps_at_hotspot",
    "Find species at a specific hotspot that are NOT on your life list",
    {
      locId: z.string().describe("eBird hotspot location ID (e.g., L1234567)"),
      back: z.number().min(1).max(30).optional().describe("Days back for recent observations (1-30, default 14)"),
    },
    async ({ locId, back }) => {
      // Get recent observations at this location using region-based query
      // The locId can be used as a region code for some endpoints
      const [observations, lifeListNames] = await Promise.all([
        client.getRecentObservations(locId, { back }),
        getLifeListNames(store),
      ]);

      if (lifeListNames.size === 0) {
        return {
          content: [{ type: "text", text: "No life list loaded. Visit this server's /upload page in your browser to upload your eBird CSV directly." }],
        };
      }

      const speciesMap = new Map<string, { obs: Observation; count: number }>();
      for (const obs of observations) {
        if (lifeListNames.has(obs.sciName)) continue;
        const existing = speciesMap.get(obs.sciName);
        if (existing) {
          existing.count++;
        } else {
          speciesMap.set(obs.sciName, { obs, count: 1 });
        }
      }

      const lifers = Array.from(speciesMap.values())
        .sort((a, b) => b.count - a.count);

      if (lifers.length === 0) {
        return {
          content: [{ type: "text", text: "No life list gaps at this hotspot recently — you've seen all the recent species!" }],
        };
      }

      const text = lifers
        .map(
          ({ obs, count }) =>
            `★ ${obs.comName} (${obs.sciName}) [${obs.speciesCode}] — ${count} recent report(s)`
        )
        .join("\n");

      return {
        content: [{ type: "text", text: `${lifers.length} species you haven't seen at this hotspot:\n\n${text}` }],
      };
    }
  );

  server.tool(
    "get_hotspots_along_route",
    "Find birding hotspots along a driving route between two points — perfect for road trip planning",
    {
      startLat: z.number().describe("Starting latitude"),
      startLng: z.number().describe("Starting longitude"),
      endLat: z.number().describe("Ending latitude"),
      endLng: z.number().describe("Ending longitude"),
      hotspotRadius: z.number().min(1).max(50).optional().describe("Radius around waypoints to search for hotspots in km (default 10)"),
      waypointInterval: z.number().min(5).max(100).optional().describe("Distance between route sample points in km (default 20)"),
    },
    async ({ startLat, startLng, endLat, endLng, hotspotRadius, waypointInterval }) => {
      const radius = hotspotRadius ?? 10;
      const interval = waypointInterval ?? 20;
      let waypoints: [number, number][];
      let routeInfo = "";

      try {
        const route = await getRoute(startLng, startLat, endLng, endLat);
        waypoints = sampleWaypoints(route.coordinates, interval);
        routeInfo = `Route: ${route.totalDistanceKm.toFixed(1)} km, ~${route.totalDurationMin.toFixed(0)} min drive\n`;
      } catch {
        // Fallback to straight-line sampling
        waypoints = sampleStraightLine(startLat, startLng, endLat, endLng, 50);
        routeInfo = "Note: Using straight-line estimation (routing service unavailable)\n";
      }

      // Query hotspots at each waypoint, deduplicate
      const seenLocIds = new Set<string>();
      const allHotspots: Hotspot[] = [];

      for (const [lat, lng] of waypoints) {
        try {
          const hotspots = await client.getNearbyHotspots(lat, lng, { dist: radius });
          for (const hs of hotspots) {
            if (!seenLocIds.has(hs.locId)) {
              seenLocIds.add(hs.locId);
              allHotspots.push(hs);
            }
          }
        } catch {
          // Skip waypoints that fail
        }
      }

      // Sort by species richness
      allHotspots.sort((a, b) => (b.numSpeciesAllTime ?? 0) - (a.numSpeciesAllTime ?? 0));

      if (allHotspots.length === 0) {
        return {
          content: [{ type: "text", text: `${routeInfo}No hotspots found along this route.` }],
        };
      }

      const text = allHotspots
        .slice(0, 30) // Top 30
        .map(
          (h, i) =>
            `${i + 1}. ${h.locName} [${h.locId}] — ${h.numSpeciesAllTime ?? "?"} species, (${h.lat.toFixed(4)}, ${h.lng.toFixed(4)})`
        )
        .join("\n");

      return {
        content: [
          {
            type: "text",
            text: `${routeInfo}${waypoints.length} waypoints sampled, ${allHotspots.length} unique hotspots found:\n\n${text}${allHotspots.length > 30 ? `\n\n... and ${allHotspots.length - 30} more.` : ""}`,
          },
        ],
      };
    }
  );
}
