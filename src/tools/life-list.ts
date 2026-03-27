import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { LifeListStore } from "../data/life-list.js";
import {
  importLifeList,
  checkLifeList,
  getLifeListStats,
  isLifeListLoaded,
} from "../data/life-list.js";

function noLifeListMessage(hasUploadEndpoint: boolean): string {
  if (hasUploadEndpoint) {
    return "No life list loaded. Visit this server's /upload page in your browser to upload your eBird CSV directly.\nDownload your data from https://ebird.org/downloadMyData first.";
  }
  return "No life list loaded. Import your life list first:\n1. Download your data from https://ebird.org/downloadMyData\n2. Use the import_life_list tool with csvPath set to the downloaded file path.";
}

export function registerLifeListTools(server: McpServer, store: LifeListStore, hasUploadEndpoint: boolean = false) {
  const importDesc = hasUploadEndpoint
    ? "Import your eBird life list from a CSV export. For large life lists, use the direct upload page at /upload on this server instead — it avoids size limitations. Go to https://ebird.org/downloadMyData to get the CSV file."
    : "Import your eBird life list from a CSV export. Go to https://ebird.org/downloadMyData to get the file. Provide either a file path or paste the CSV content directly.";

  server.tool(
    "import_life_list",
    importDesc,
    {
      csvPath: z.string().optional().describe("Absolute path to the eBird CSV export file (local mode)"),
      csvContent: z.string().optional().describe("Raw CSV content pasted directly (remote/cloud mode)"),
    },
    async ({ csvPath, csvContent }) => {
      try {
        let content: string;
        if (csvContent) {
          content = csvContent;
        } else if (csvPath) {
          // Dynamic import so fs is not bundled in Cloudflare Worker builds
          const fs = await import("fs");
          content = fs.readFileSync(csvPath, "utf-8");
        } else {
          return {
            content: [
              {
                type: "text",
                text: "Please provide either a csvPath (file path) or csvContent (pasted CSV text).",
              },
            ],
          };
        }

        const result = await importLifeList(content, store);
        return {
          content: [
            {
              type: "text",
              text: `Life list imported successfully!\n${result.totalSpecies} species from ${result.countries} countries.`,
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
      const loaded = await isLifeListLoaded(store);
      if (!loaded) {
        return {
          content: [
            {
              type: "text",
              text: noLifeListMessage(hasUploadEndpoint),
            },
          ],
        };
      }

      const entry = await checkLifeList(scientificName, store);
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
      const stats = await getLifeListStats(store);
      if (stats.totalSpecies === 0) {
        return {
          content: [
            {
              type: "text",
              text: noLifeListMessage(hasUploadEndpoint),
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
