import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { EBirdClient } from "../clients/ebird.js";
import { getMediaCounts, type MediaCounts, type MacaulayFilters } from "../clients/macaulay.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function registerMediaTools(server: McpServer, client: EBirdClient) {
  server.tool(
    "get_media_gaps",
    "Find species with the fewest regional media records — useful only for under-birded regions (e.g. MX-ROO, small islands). Avoid for well-birded regions like US where results are meaningless. Queries Macaulay Library only.",
    {
      regionCode: z.string().describe("eBird region code (e.g., MX-ROO, CU, HN). Best for under-birded regions."),
      maxSpecies: z.number().min(1).max(200).optional().describe("Max species to check (default 50, max 200). Higher = slower."),
      mediaType: z.enum(["all", "audio", "photo", "video"]).optional().describe("Type of media to check (default 'all')"),
      age: z.enum(["Adult", "Immature", "Juvenile", "Unknown"]).optional().describe("Filter by age class (e.g., find species missing Juvenile photos)"),
      sex: z.enum(["Male", "Female", "Unknown"]).optional().describe("Filter by sex (e.g., find species missing Female photos)"),
      tag: z.string().optional().describe("Filter by behavior/sound tag: call, song, dawn_song, non_vocal, flight_call, foraging_eating, flying_flight, molting, vocalizing, courtship_display_or_copulation, feeding_young"),
      qualityAbove: z.number().min(1).max(5).optional().describe("Only count media rated above this star threshold (1-5). Useful for finding species lacking high-quality media."),
    },
    async ({ regionCode, maxSpecies, mediaType, age, sex, tag, qualityAbove }) => {
      const limit = maxSpecies ?? 50;
      const type = mediaType ?? "all";
      const filters: MacaulayFilters = {};
      if (age) filters.age = age;
      if (sex) filters.sex = sex;
      if (tag) filters.tag = tag;
      if (qualityAbove !== undefined) filters.qualityAbove = qualityAbove;

      // Get species list and taxonomy
      const speciesCodes = await client.getSpeciesList(regionCode);
      const codesToCheck = speciesCodes.slice(0, limit);

      // Get taxonomy for scientific names
      const taxonomy = await client.getTaxonomy({ species: codesToCheck.join(",") });
      const taxMap = new Map(taxonomy.map((t) => [t.speciesCode, t]));

      const results: Array<{
        speciesCode: string;
        comName: string;
        sciName: string;
        macaulay: MediaCounts;
        totalMedia: number;
      }> = [];

      for (const code of codesToCheck) {
        const taxon = taxMap.get(code);
        if (!taxon) continue;

        let macaulay: MediaCounts = { photo: 0, audio: 0, video: 0, total: 0 };

        try {
          macaulay = await getMediaCounts(code, regionCode, filters);
          await sleep(400); // ~2.5 req/sec for Macaulay (3 calls per species)
        } catch {
          // Macaulay fallback: skip
        }

        let total: number;
        if (type === "audio") {
          total = macaulay.audio;
        } else if (type === "photo") {
          total = macaulay.photo;
        } else if (type === "video") {
          total = macaulay.video;
        } else {
          total = macaulay.total;
        }

        results.push({
          speciesCode: code,
          comName: taxon.comName,
          sciName: taxon.sciName,
          macaulay,
          totalMedia: total,
        });
      }

      // Sort by fewest media
      results.sort((a, b) => a.totalMedia - b.totalMedia);

      const fmt = (n: number) => n >= 100 ? "100+" : String(n);

      const top = results.slice(0, 30);
      const text = top
        .map(
          (r, i) =>
            `${i + 1}. ${r.comName} (${r.sciName}) [${r.speciesCode}]\n   ${fmt(r.macaulay.photo)} photos, ${fmt(r.macaulay.audio)} audio, ${fmt(r.macaulay.video)} video | Total: ${fmt(r.totalMedia)}`
        )
        .join("\n");

      const filterParts: string[] = [];
      if (age) filterParts.push(`age=${age}`);
      if (sex) filterParts.push(`sex=${sex}`);
      if (tag) filterParts.push(`tag=${tag}`);
      if (qualityAbove) filterParts.push(`rated ${qualityAbove}+ stars`);
      const filterNote = filterParts.length > 0 ? ` [filters: ${filterParts.join(", ")}]` : "";

      return {
        content: [
          {
            type: "text",
            text: `Media gaps in ${regionCode}${filterNote} (source: Macaulay Library | checked ${codesToCheck.length} of ${speciesCodes.length} species, sorted by fewest ${type} media):\n\n${text}`,
          },
        ],
      };
    }
  );
}
