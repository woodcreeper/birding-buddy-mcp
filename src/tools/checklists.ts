import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { EBirdClient, Observation } from "../clients/ebird.js";

// Checklist access has two entry points:
// 1. FROM A KNOWN SIGHTING: observation results include subId — pass directly to
//    view_checklist with zero extra queries.
// 2. FROM NATURAL LANGUAGE: resolve_hotspot → get_recent_checklists → view_checklist
//    (three calls max). Never exceed this chain.

export function registerChecklistTools(server: McpServer, client: EBirdClient) {
  server.tool(
    "get_hotspot_observations",
    "Get recent bird observations at a specific eBird hotspot by location ID. Use resolve_hotspot first if you only have a name.",
    {
      locId: z.string().describe("eBird hotspot location ID (e.g., L1234567)"),
      back: z.number().min(1).max(30).optional().describe("Number of days back (1-30, default 14)"),
      maxResults: z.number().optional().describe("Max results to return"),
    },
    async ({ locId, back, maxResults }) => {
      const obs = await client.getRecentObservations(locId, { back, maxResults });

      if (obs.length === 0) {
        return {
          content: [{
            type: "text",
            text: `No recent observations at hotspot ${locId}.\nHotspot: https://ebird.org/hotspot/${locId}`,
          }],
        };
      }

      const header = `Hotspot: https://ebird.org/hotspot/${locId}\n`;
      const lines = obs.map(
        (o: Observation) =>
          `${o.comName} (${o.sciName}) [${o.speciesCode}] — ${o.howMany ?? "X"} at ${o.locName} (${o.obsDt}) [checklist: ${o.subId} — https://ebird.org/checklist/${o.subId}]`
      );

      return {
        content: [{ type: "text", text: header + lines.join("\n") }],
      };
    }
  );

  server.tool(
    "get_recent_checklists",
    "Get recent checklists submitted at a hotspot or in a region. Returns subId for each checklist so a specific one can be viewed with view_checklist. Use resolve_hotspot first if you only have a hotspot name.",
    {
      locId: z.string().optional().describe("eBird hotspot location ID (e.g., L1234567)"),
      regionCode: z.string().optional().describe("eBird region code (e.g., US-NJ)"),
      lat: z.number().optional().describe("Latitude (use with lng to find checklists near a location)"),
      lng: z.number().optional().describe("Longitude (use with lat)"),
      maxResults: z.number().optional().describe("Max results to return (default 10)"),
    },
    async ({ locId, regionCode, lat, lng, maxResults }) => {
      const max = maxResults ?? 10;

      if (lat != null && lng != null && !locId && !regionCode) {
        // Fetch checklists from the nearest hotspots directly
        const hotspots = await client.getNearbyHotspots(lat, lng, { dist: 50 });
        if (hotspots.length === 0) {
          return {
            content: [{
              type: "text",
              text: "No hotspots found within 50 km of that location. Try providing a regionCode directly (e.g., US-NJ).",
            }],
          };
        }

        // Query the top 5 nearest hotspots for checklists, merge results
        const topHotspots = hotspots.slice(0, 5);
        const allEntries = (
          await Promise.all(
            topHotspots.map((h) =>
              client.getChecklistFeed(h.locId, { maxResults: max }).catch(() => [])
            )
          )
        ).flat();

        // Sort by date descending, take top N
        allEntries.sort((a, b) => b.obsDt.localeCompare(a.obsDt));
        const entries = allEntries.slice(0, max);

        if (entries.length === 0) {
          return {
            content: [{
              type: "text",
              text: "No recent checklists found at nearby hotspots.",
            }],
          };
        }

        const lines = entries.map((e) => {
          const time = e.obsTime ? ` ${e.obsTime}` : "";
          return [
            `${e.userDisplayName} — ${e.numSpecies} species at ${e.loc.name} (${e.obsDt}${time})`,
            `  Checklist: https://ebird.org/checklist/${e.subId}`,
            `  Hotspot: https://ebird.org/hotspot/${e.loc.locId}`,
          ].join("\n");
        });

        return {
          content: [{
            type: "text",
            text: `Recent checklists near ${lat.toFixed(3)}, ${lng.toFixed(3)} (from ${topHotspots.length} nearby hotspots):\n\n${lines.join("\n\n")}`,
          }],
        };
      }

      // locId or regionCode path
      const feedRegion = locId ?? regionCode;
      if (!feedRegion) {
        return {
          content: [{
            type: "text",
            text: "Please provide at least one of: locId, regionCode, or lat+lng.",
          }],
        };
      }

      const entries = await client.getChecklistFeed(feedRegion, { maxResults: max });

      if (entries.length === 0) {
        return {
          content: [{
            type: "text",
            text: `No recent checklists found for ${feedRegion}.`,
          }],
        };
      }

      const lines = entries.map((e) => {
        const time = e.obsTime ? ` ${e.obsTime}` : "";
        return [
          `${e.userDisplayName} — ${e.numSpecies} species at ${e.loc.name} (${e.obsDt}${time})`,
          `  Checklist: https://ebird.org/checklist/${e.subId}`,
          `  Hotspot: https://ebird.org/hotspot/${e.loc.locId}`,
        ].join("\n");
      });

      return {
        content: [{
          type: "text",
          text: `Recent checklists for ${feedRegion}:\n\n${lines.join("\n\n")}`,
        }],
      };
    }
  );

  server.tool(
    "view_checklist",
    "View the full species list for a specific eBird checklist. The subId can come from get_recent_checklists or directly from observation results which already include subId in their payload — in that case call this directly with no extra queries needed. WARNING: Never call this in a loop or batch across multiple subIds. One call per explicit user request only.",
    {
      subId: z.string().describe("eBird checklist submission ID (e.g., S12345678)"),
    },
    async ({ subId }) => {
      const checklist = await client.getChecklistView(subId);

      // Resolve species codes to common names via taxonomy API
      const codes = checklist.obs.map((o) => o.speciesCode);
      const nameMap = new Map<string, string>();
      if (codes.length > 0) {
        try {
          const taxonomy = await client.getTaxonomy({ species: codes.join(",") });
          for (const t of taxonomy) {
            nameMap.set(t.speciesCode, t.comName);
          }
        } catch {
          // Fall back to species codes if taxonomy lookup fails
        }
      }

      const loc = checklist.loc;
      const locationLine = loc
        ? loc.isHotspot
          ? `Location: ${loc.name} (${loc.locId}) — https://ebird.org/hotspot/${loc.locId}`
          : `Location: ${loc.name} (${loc.locId})`
        : `Location: ${checklist.locId}`;

      const lines = [
        `Checklist: https://ebird.org/checklist/${checklist.subId}`,
        `Observer: ${checklist.userDisplayName}`,
        locationLine,
        loc ? `${loc.subnational1Name}, ${loc.countryName}` : null,
        `Date: ${checklist.obsDt}`,
        `Protocol: ${checklist.protocolId}`,
        checklist.numObservers ? `Observers: ${checklist.numObservers}` : null,
        checklist.durationHrs != null ? `Duration: ${checklist.durationHrs} hrs` : null,
        checklist.effortDistanceKm != null ? `Distance: ${checklist.effortDistanceKm} km` : null,
        `Species: ${checklist.numSpecies}`,
        checklist.subComments ? `\nNotes: ${checklist.subComments}` : null,
      ].filter(Boolean);

      const speciesList = checklist.obs
        .map((o) => {
          const name = nameMap.get(o.speciesCode) ?? o.speciesCode;
          return `  ${name} — ${o.howManyStr ?? "X"}${o.obsComments ? ` (${o.obsComments})` : ""}`;
        })
        .join("\n");

      return {
        content: [{
          type: "text",
          text: `${lines.join("\n")}\n\nSpecies observed:\n${speciesList}`,
        }],
      };
    }
  );
}
