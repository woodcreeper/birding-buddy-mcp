import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  importLifeList,
  checkLifeList,
  getLifeListStats,
} from "../data/life-list.js";

export function registerLifeListTools(server: McpServer) {
  server.tool(
    "import_life_list",
    "Import your eBird life list from a CSV export. Go to My eBird → Download My Data to get the file.",
    {
      csvPath: z.string().describe("Absolute path to the eBird CSV export file"),
    },
    async ({ csvPath }) => {
      try {
        const result = await importLifeList(csvPath);
        return {
          content: [
            {
              type: "text",
              text: `Life list imported successfully!\n${result.totalSpecies} species from ${result.countries} countries.\nStored at ~/.ebird-mcp/life-list.json`,
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text",
              text: `Error importing life list: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
        };
      }
    }
  );

  server.tool(
    "check_life_list",
    "Check if a species is on your life list",
    {
      scientificName: z.string().describe("Scientific name of the species (e.g., 'Haliaeetus leucocephalus')"),
    },
    async ({ scientificName }) => {
      const entry = await checkLifeList(scientificName);
      if (entry) {
        return {
          content: [
            {
              type: "text",
              text: `✓ ${entry.commonName} (${entry.scientificName}) is on your life list.\nFirst observed: ${entry.firstObsDate} in ${entry.country}`,
            },
          ],
        };
      }
      return {
        content: [
          {
            type: "text",
            text: `✗ ${scientificName} is NOT on your life list — this would be a lifer!`,
          },
        ],
      };
    }
  );

  server.tool(
    "get_life_list_stats",
    "Get summary statistics about your life list — total species, by country, by year",
    {},
    async () => {
      const stats = await getLifeListStats();
      if (stats.totalSpecies === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No life list loaded. Use import_life_list to import your eBird data first.",
            },
          ],
        };
      }

      const countryLines = Object.entries(stats.byCountry)
        .sort(([, a], [, b]) => b - a)
        .map(([country, count]) => `  ${country}: ${count}`)
        .join("\n");

      const yearLines = Object.entries(stats.byYear)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([year, count]) => `  ${year}: ${count}`)
        .join("\n");

      return {
        content: [
          {
            type: "text",
            text: `Life List Summary\n${"=".repeat(40)}\nTotal species: ${stats.totalSpecies}\n\nBy country:\n${countryLines}\n\nBy year:\n${yearLines}`,
          },
        ],
      };
    }
  );
}
