import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getRecordingCounts } from "../clients/xeno-canto.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function registerXenoCantoTools(
  server: McpServer,
  xcApiKey?: string
) {
  server.tool(
    "get_recording_counts",
    "Get a summary count of Xeno-canto recordings for a species broken down by quality grade (A=best through E=worst). Use this ONLY after you have already presented a species list to the user and they have confirmed they want recording gap data. Do not call this speculatively. Returns total count and per-grade breakdown. Ideal for identifying which species in a list are underrepresented and would most benefit from new recordings.",
    {
      speciesName: z
        .string()
        .describe("English name or scientific name of the species"),
      country: z
        .string()
        .optional()
        .describe('Filter to a specific country (e.g., "Mexico")'),
    },
    async ({ speciesName, country }) => {
      if (!xcApiKey) {
        return {
          content: [
            {
              type: "text",
              text: "Xeno-canto API key not configured. Add XC_API_KEY to your .env file — see README for instructions.",
            },
          ],
          isError: true,
        };
      }

      const counts = await getRecordingCounts(xcApiKey, speciesName, country);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(counts, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "enrich_species_list",
    "Append Xeno-canto recording counts and quality grades to an array of species. Call this ONLY after presenting a species list to the user AND receiving explicit confirmation that they want to see recording gap data. This tool makes one API call per species and can be slow for large lists — warn the user if the list exceeds 20 species. For 50 species expect ~10 seconds. Returns the input list sorted by fewest A-grade recordings first, so the highest-priority recording targets appear at the top.",
    {
      species: z
        .array(
          z.object({
            commonName: z.string(),
            scientificName: z.string(),
            speciesCode: z.string(),
          })
        )
        .describe("Array of species to enrich with XC data"),
      country: z
        .string()
        .optional()
        .describe("Filter XC counts to a specific country"),
    },
    async ({ species, country }) => {
      if (!xcApiKey) {
        return {
          content: [
            {
              type: "text",
              text: "Xeno-canto API key not configured. Add XC_API_KEY to your .env file — see README for instructions.",
            },
          ],
          isError: true,
        };
      }

      const enriched: Array<{
        commonName: string;
        scientificName: string;
        speciesCode: string;
        xcTotal: number;
        xcGrades: { A: number; B: number; C: number; D: number; E: number };
      }> = [];

      for (const sp of species) {
        const counts = await getRecordingCounts(
          xcApiKey,
          sp.scientificName,
          country
        );

        enriched.push({
          ...sp,
          xcTotal: counts.total,
          xcGrades: counts.grades,
        });

        await sleep(200); // Respect rate limits
      }

      // Sort by fewest A-grade recordings (highest-priority targets first)
      enriched.sort((a, b) => a.xcGrades.A - b.xcGrades.A);

      const text = enriched
        .map(
          (r, i) =>
            `${i + 1}. ${r.commonName} (${r.scientificName}) [${r.speciesCode}]\n   XC total: ${r.xcTotal} | A: ${r.xcGrades.A}, B: ${r.xcGrades.B}, C: ${r.xcGrades.C}, D: ${r.xcGrades.D}, E: ${r.xcGrades.E}`
        )
        .join("\n");

      return {
        content: [
          {
            type: "text",
            text: `Xeno-canto recording counts for ${enriched.length} species${country ? ` in ${country}` : ""}, sorted by fewest A-grade recordings:\n\n${text}`,
          },
        ],
      };
    }
  );
}
