import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { EBirdClient } from "../clients/ebird.js";

export function registerTaxonomyTools(server: McpServer, client: EBirdClient) {
  server.tool(
    "get_taxonomy",
    "Look up bird taxonomy — species codes, scientific names, families. Use 'species' param to look up specific species codes.",
    {
      species: z.string().optional().describe("Comma-separated species codes to look up (e.g., 'baleag,rewbla')"),
      locale: z.string().optional().describe("Locale for common names (e.g., 'en', 'es', 'fr')"),
    },
    async ({ species, locale }) => {
      const entries = await client.getTaxonomy({ species, locale });
      if (entries.length === 0) return { content: [{ type: "text", text: "No taxonomy entries found." }] };

      const text = entries
        .slice(0, 100) // Cap output to avoid overwhelming response
        .map(
          (e) =>
            `${e.comName} (${e.sciName}) [${e.speciesCode}] — ${e.familyComName} (${e.familySciName}), Order: ${e.order}`
        )
        .join("\n");

      const suffix = entries.length > 100 ? `\n\n... and ${entries.length - 100} more entries. Use the 'species' parameter to filter.` : "";
      return { content: [{ type: "text", text: text + suffix }] };
    }
  );

  server.tool(
    "get_species_list",
    "Get all species ever recorded in a region — returns species codes",
    {
      regionCode: z.string().describe("eBird region code (e.g., US-NY, MX-ROO)"),
    },
    async ({ regionCode }) => {
      const speciesCodes = await client.getSpeciesList(regionCode);
      return {
        content: [
          {
            type: "text",
            text: `${speciesCodes.length} species recorded in ${regionCode}:\n${speciesCodes.join(", ")}`,
          },
        ],
      };
    }
  );
}
