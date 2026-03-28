import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { EBirdClient, Hotspot } from "../clients/ebird.js";
import { haversineDistance } from "../utils/geo.js";

function formatHotspots(hotspots: Hotspot[]): string {
  if (hotspots.length === 0) return "No hotspots found.";
  return hotspots
    .map(
      (h) =>
        `${h.locName} [${h.locId}] — ${h.numSpeciesAllTime ?? "?"} species all-time, lat ${h.lat}, lng ${h.lng}${h.latestObsDt ? `, last obs ${h.latestObsDt}` : ""} — https://ebird.org/hotspot/${h.locId}`
    )
    .join("\n");
}

export function registerHotspotTools(server: McpServer, client: EBirdClient) {
  server.tool(
    "get_hotspots_in_region",
    "Get birding hotspots in a region — great for trip planning",
    {
      regionCode: z.string().describe("eBird region code (e.g., US-NY, MX-ROO)"),
      back: z.number().min(1).max(30).optional().describe("Only hotspots with observations in last N days"),
    },
    async ({ regionCode, back }) => {
      const hotspots = await client.getHotspotsInRegion(regionCode, { back });
      return { content: [{ type: "text", text: formatHotspots(hotspots) }] };
    }
  );

  server.tool(
    "get_nearby_hotspots",
    "Find birding hotspots near a latitude/longitude — perfect for 'where should I bird near here'",
    {
      lat: z.number().describe("Latitude"),
      lng: z.number().describe("Longitude"),
      dist: z.number().min(0).max(50).optional().describe("Search radius in km (0-50, default 25)"),
      back: z.number().min(1).max(30).optional().describe("Only hotspots active in last N days"),
    },
    async ({ lat, lng, dist, back }) => {
      const hotspots = await client.getNearbyHotspots(lat, lng, { dist, back });
      return { content: [{ type: "text", text: formatHotspots(hotspots) }] };
    }
  );

  server.tool(
    "get_hotspot_info",
    "Get detailed info about a specific birding hotspot",
    {
      locId: z.string().describe("eBird hotspot location ID (e.g., L1234567)"),
    },
    async ({ locId }) => {
      const hotspot = await client.getHotspotInfo(locId);
      const lines = [
        `Name: ${hotspot.locName}`,
        `ID: ${hotspot.locId}`,
        `Location: ${hotspot.lat}, ${hotspot.lng}`,
        `Country: ${hotspot.countryCode}`,
        `Region: ${hotspot.subnational1Code}`,
        hotspot.numSpeciesAllTime ? `Species all-time: ${hotspot.numSpeciesAllTime}` : null,
        hotspot.latestObsDt ? `Latest observation: ${hotspot.latestObsDt}` : null,
        `URL: https://ebird.org/hotspot/${hotspot.locId}`,
      ].filter(Boolean);
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );

  server.tool(
    "resolve_hotspot",
    "Find an eBird hotspot by common name. Returns locId, full name, coordinates, and a direct eBird URL. If multiple matches are found, returns them sorted by distance from your location.",
    {
      name: z.string().describe("Hotspot name to search for (e.g., 'Coral Avenue' or 'Coral Avenue Cape May Point')"),
      lat: z.number().describe("Your current latitude"),
      lng: z.number().describe("Your current longitude"),
      dist: z.number().min(0).max(500).optional().describe("Search radius in km (default 50)"),
    },
    async ({ name, lat, lng, dist }) => {
      const hotspots = await client.getNearbyHotspots(lat, lng, { dist: dist ?? 50 });
      const needle = name.toLowerCase();

      const matches = hotspots.filter((h) =>
        h.locName.toLowerCase().includes(needle)
      );

      if (matches.length === 0) {
        return {
          content: [{
            type: "text",
            text: `No hotspots matching "${name}" found within ${dist ?? 50} km. Try widening the search radius or using a different name.`,
          }],
        };
      }

      // Sort by distance from user
      matches.sort((a, b) =>
        haversineDistance(lat, lng, a.lat, a.lng) - haversineDistance(lat, lng, b.lat, b.lng)
      );

      if (matches.length === 1) {
        const h = matches[0];
        const distKm = haversineDistance(lat, lng, h.lat, h.lng).toFixed(1);
        return {
          content: [{
            type: "text",
            text: [
              `${h.locName} [${h.locId}]`,
              `Location: ${h.lat}, ${h.lng} (${distKm} km away)`,
              h.numSpeciesAllTime ? `Species all-time: ${h.numSpeciesAllTime}` : null,
              `URL: https://ebird.org/hotspot/${h.locId}`,
            ].filter(Boolean).join("\n"),
          }],
        };
      }

      // Multiple matches — return up to 5
      const top = matches.slice(0, 5);
      const lines = top.map((h) => {
        const distKm = haversineDistance(lat, lng, h.lat, h.lng).toFixed(1);
        return `${h.locName} [${h.locId}] — ${h.numSpeciesAllTime ?? "?"} species, ${distKm} km away — https://ebird.org/hotspot/${h.locId}`;
      });

      return {
        content: [{
          type: "text",
          text: `Found ${matches.length} hotspots matching "${name}" — here are the closest${matches.length > 5 ? ` (showing 5 of ${matches.length})` : ""}. Can you be more specific?\n\n${lines.join("\n")}`,
        }],
      };
    }
  );
}
