import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { EBirdClient } from "./clients/ebird.js";
import type { LifeListStore } from "./data/life-list.js";
import { registerObservationTools } from "./tools/observations.js";
import { registerHotspotTools } from "./tools/hotspots.js";
import { registerTaxonomyTools } from "./tools/taxonomy.js";
import { registerReferenceTools } from "./tools/reference.js";
import { registerLifeListTools } from "./tools/life-list.js";
import { registerCompoundTools } from "./tools/compound.js";
import { registerMediaTools } from "./tools/media.js";
import { registerFrequencyTools } from "./tools/frequency.js";
import { registerXenoCantoTools } from "./tools/xeno-canto.js";
import { BIRDING_BUDDY_INSTRUCTIONS } from "./prompts/birding-buddy.js";

export function createServer(apiKey: string, xcApiKey: string | undefined, lifeListStore: LifeListStore): McpServer {
  const server = new McpServer(
    { name: "birding-buddy-mcp", version: "1.0.0" },
    { instructions: BIRDING_BUDDY_INSTRUCTIONS }
  );

  const client = new EBirdClient(apiKey);

  // Core eBird API tools (12)
  registerObservationTools(server, client);
  registerHotspotTools(server, client);
  registerTaxonomyTools(server, client);
  registerReferenceTools(server, client);

  // Life list tools (3)
  registerLifeListTools(server, lifeListStore);

  // Compound intelligence tools (3) + media (1)
  registerCompoundTools(server, client, lifeListStore);
  registerMediaTools(server, client);

  // Utility tools (1)
  registerFrequencyTools(server, client);

  // Xeno-canto enrichment tools (2)
  registerXenoCantoTools(server, xcApiKey);

  // Birding Buddy prompt (for explicit re-invocation)
  server.prompt(
    "birding-buddy",
    "Field birding assistant — tool routing, presentation, and workflow instructions",
    () => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: BIRDING_BUDDY_INSTRUCTIONS,
          },
        },
      ],
    })
  );

  return server;
}
