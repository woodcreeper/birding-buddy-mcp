import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { EBirdClient } from "../clients/ebird.js";
import { resolveRegionCode } from "../utils/region-resolver.js";

export function registerReferenceTools(server: McpServer, client: EBirdClient) {
  server.tool(
    "get_region_info",
    "Get info about an eBird region — name, coordinates, bounds",
    {
      regionCode: z.string().describe("eBird region code (e.g., US-NY, MX)"),
    },
    async ({ regionCode }) => {
      const info = await client.getRegionInfo(regionCode);
      const lines = [
        `Region: ${info.result}`,
        `Code: ${info.code}`,
        `Type: ${info.type}`,
        info.latitude != null ? `Center: ${info.latitude}, ${info.longitude}` : null,
        info.bounds ? `Bounds: (${info.bounds.minY}, ${info.bounds.minX}) to (${info.bounds.maxY}, ${info.bounds.maxX})` : null,
      ].filter(Boolean);
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );

  server.tool(
    "get_sub_regions",
    "Get sub-regions of a parent region (e.g., states within a country, counties within a state)",
    {
      regionCode: z.string().describe("Parent region code (e.g., 'MX' for Mexico, 'US-NY' for New York)"),
      regionType: z.enum(["country", "subnational1", "subnational2"]).describe("Type of sub-regions to list"),
    },
    async ({ regionCode, regionType }) => {
      const regions = await client.getSubRegions(regionCode, regionType);
      if (regions.length === 0) return { content: [{ type: "text", text: "No sub-regions found." }] };

      const text = regions.map((r) => `${r.name} [${r.code}]`).join("\n");
      return { content: [{ type: "text", text: `${regions.length} sub-regions:\n${text}` }] };
    }
  );

  server.tool(
    "resolve_region_code",
    "Fuzzy-match a place name to an eBird region code (e.g., 'Quintana Roo' → MX-ROO, 'New York' → US-NY)",
    {
      placeName: z.string().describe("Place name to look up (e.g., 'Quintana Roo', 'Ontario', 'Brazil')"),
    },
    async ({ placeName }) => {
      const result = await resolveRegionCode(client, placeName);
      if (!result) {
        return { content: [{ type: "text", text: `Could not resolve "${placeName}" to an eBird region code. Try a more specific name or use eBird region codes directly (e.g., US-NY, MX-ROO).` }] };
      }
      return { content: [{ type: "text", text: `"${placeName}" → ${result.name} [${result.code}]` }] };
    }
  );
}
