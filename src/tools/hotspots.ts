import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { EBirdClient, Hotspot } from "../clients/ebird.js";

function formatHotspots(hotspots: Hotspot[]): string {
  if (hotspots.length === 0) return "No hotspots found.";
  return hotspots
    .map(
      (h) =>
        `${h.locName} [${h.locId}] — ${h.numSpeciesAllTime ?? "?"} species all-time, lat ${h.lat}, lng ${h.lng}${h.latestObsDt ? `, last obs ${h.latestObsDt}` : ""}`
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
      ].filter(Boolean);
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );
}
