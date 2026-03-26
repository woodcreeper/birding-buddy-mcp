import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { EBirdClient } from "../clients/ebird.js";

export function registerFrequencyTools(server: McpServer, client: EBirdClient) {
  server.tool(
    "get_observation_frequency",
    "Estimate how likely a species is to be seen at a location during a specific week — uses historic observation data as a proxy for detection probability",
    {
      regionCode: z.string().describe("eBird region code"),
      speciesCode: z.string().describe("eBird species code"),
      month: z.number().min(1).max(12).describe("Month (1-12)"),
      day: z.number().min(1).max(31).describe("Day of month (1-31) — center of the week to check"),
    },
    async ({ regionCode, speciesCode, month, day }) => {
      // Check this date across multiple recent years to estimate frequency
      const currentYear = new Date().getFullYear();
      const yearsToCheck = [currentYear - 1, currentYear - 2, currentYear - 3];

      let totalChecklists = 0;
      let detections = 0;

      for (const year of yearsToCheck) {
        try {
          const obs = await client.getHistoricObservations(regionCode, year, month, day, {
            detail: "simple",
          });
          // Count checklists that include this species
          const speciesObs = obs.filter((o) => o.speciesCode === speciesCode);
          if (speciesObs.length > 0) detections++;
          totalChecklists++;
        } catch {
          // Some dates/years may not have data
        }
      }

      if (totalChecklists === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No historic data available for ${speciesCode} in ${regionCode} around ${month}/${day}. Try a different date or region.`,
            },
          ],
        };
      }

      const frequency = detections / totalChecklists;
      const label =
        frequency >= 0.8 ? "Very likely" :
        frequency >= 0.5 ? "Likely" :
        frequency >= 0.2 ? "Possible" :
        frequency > 0 ? "Uncommon" :
        "Not detected";

      return {
        content: [
          {
            type: "text",
            text: `${speciesCode} in ${regionCode} around ${month}/${day}:\nDetected in ${detections}/${totalChecklists} years checked (${(frequency * 100).toFixed(0)}%)\nLikelihood: ${label}\n\nNote: This is a rough estimate based on ${yearsToCheck.length} years of historic data for this exact date.`,
          },
        ],
      };
    }
  );
}
