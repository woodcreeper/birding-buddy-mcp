import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { EBirdClient, Observation } from "../clients/ebird.js";

function formatObservations(obs: Observation[]): string {
  if (obs.length === 0) return "No observations found.";
  return obs
    .map(
      (o) =>
        `${o.comName} (${o.sciName}) [${o.speciesCode}] — ${o.howMany ?? "X"} at ${o.locName} (${o.obsDt})`
    )
    .join("\n");
}

export function registerObservationTools(server: McpServer, client: EBirdClient) {
  server.tool(
    "get_recent_observations",
    "Get recent bird observations in a region (e.g., US-NY, MX-ROO, CA-ON)",
    {
      regionCode: z.string().describe("eBird region code (e.g., US-NY, MX, BR-SP)"),
      back: z.number().min(1).max(30).optional().describe("Number of days back (1-30, default 14)"),
      maxResults: z.number().optional().describe("Max results to return"),
      hotspot: z.boolean().optional().describe("Only include observations from hotspots"),
    },
    async ({ regionCode, back, maxResults, hotspot }) => {
      const obs = await client.getRecentObservations(regionCode, { back, maxResults, hotspot });
      return { content: [{ type: "text", text: formatObservations(obs) }] };
    }
  );

  server.tool(
    "get_notable_observations",
    "Get rare/unusual bird observations in a region — great for finding rarities",
    {
      regionCode: z.string().describe("eBird region code"),
      back: z.number().min(1).max(30).optional().describe("Days back (1-30)"),
      maxResults: z.number().optional().describe("Max results"),
    },
    async ({ regionCode, back, maxResults }) => {
      const obs = await client.getNotableObservations(regionCode, { back, maxResults });
      return { content: [{ type: "text", text: formatObservations(obs) }] };
    }
  );

  server.tool(
    "get_nearby_observations",
    "Get recent observations near a latitude/longitude — useful for 'what birds are near me right now'",
    {
      lat: z.number().describe("Latitude"),
      lng: z.number().describe("Longitude"),
      dist: z.number().min(0).max(50).optional().describe("Search radius in km (0-50, default 25)"),
      back: z.number().min(1).max(30).optional().describe("Days back (1-30)"),
      maxResults: z.number().optional().describe("Max results"),
      hotspot: z.boolean().optional().describe("Only hotspot observations"),
    },
    async ({ lat, lng, dist, back, maxResults, hotspot }) => {
      const obs = await client.getNearbyObservations(lat, lng, { dist, back, maxResults, hotspot });
      return { content: [{ type: "text", text: formatObservations(obs) }] };
    }
  );

  server.tool(
    "get_nearby_notable_observations",
    "Get rare/unusual observations near a location",
    {
      lat: z.number().describe("Latitude"),
      lng: z.number().describe("Longitude"),
      dist: z.number().min(0).max(50).optional().describe("Search radius in km (0-50)"),
      back: z.number().min(1).max(30).optional().describe("Days back (1-30)"),
    },
    async ({ lat, lng, dist, back }) => {
      const obs = await client.getNearbyNotableObservations(lat, lng, { dist, back });
      return { content: [{ type: "text", text: formatObservations(obs) }] };
    }
  );

  server.tool(
    "get_observations_for_species",
    "Get recent observations of a specific species in a region",
    {
      regionCode: z.string().describe("eBird region code"),
      speciesCode: z.string().describe("eBird species code (e.g., baleag for Bald Eagle)"),
      back: z.number().min(1).max(30).optional().describe("Days back (1-30)"),
      maxResults: z.number().optional().describe("Max results"),
    },
    async ({ regionCode, speciesCode, back, maxResults }) => {
      const obs = await client.getObservationsForSpecies(regionCode, speciesCode, { back, maxResults });
      return { content: [{ type: "text", text: formatObservations(obs) }] };
    }
  );

  server.tool(
    "get_nearest_observations_for_species",
    "Find the nearest recent observation of a specific species to a location",
    {
      speciesCode: z.string().describe("eBird species code"),
      lat: z.number().describe("Latitude"),
      lng: z.number().describe("Longitude"),
      dist: z.number().min(0).max(50).optional().describe("Search radius in km"),
      back: z.number().min(1).max(30).optional().describe("Days back (1-30)"),
    },
    async ({ speciesCode, lat, lng, dist, back }) => {
      const obs = await client.getNearestObservationsForSpecies(speciesCode, lat, lng, { dist, back });
      return { content: [{ type: "text", text: formatObservations(obs) }] };
    }
  );

  server.tool(
    "get_historic_observations",
    "Get bird observations from a specific date in history at a region",
    {
      regionCode: z.string().describe("eBird region code"),
      year: z.number().describe("Year"),
      month: z.number().min(1).max(12).describe("Month (1-12)"),
      day: z.number().min(1).max(31).describe("Day (1-31)"),
      maxResults: z.number().optional().describe("Max results"),
    },
    async ({ regionCode, year, month, day, maxResults }) => {
      const obs = await client.getHistoricObservations(regionCode, year, month, day, { maxResults });
      return { content: [{ type: "text", text: formatObservations(obs) }] };
    }
  );
}
