import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { EBirdClient } from "./clients/ebird.js";
import { registerObservationTools } from "./tools/observations.js";
import { registerHotspotTools } from "./tools/hotspots.js";
import { registerTaxonomyTools } from "./tools/taxonomy.js";
import { registerReferenceTools } from "./tools/reference.js";
import { registerLifeListTools } from "./tools/life-list.js";
import { registerCompoundTools } from "./tools/compound.js";
import { registerMediaTools } from "./tools/media.js";
import { registerFrequencyTools } from "./tools/frequency.js";

export function createServer(apiKey: string): McpServer {
  const server = new McpServer({
    name: "ebird-mcp",
    version: "1.0.0",
  });

  const client = new EBirdClient(apiKey);

  // Core eBird API tools (12)
  registerObservationTools(server, client);
  registerHotspotTools(server, client);
  registerTaxonomyTools(server, client);
  registerReferenceTools(server, client);

  // Life list tools (3)
  registerLifeListTools(server);

  // Compound intelligence tools (3) + media (1)
  registerCompoundTools(server, client);
  registerMediaTools(server, client);

  // Utility tools (1)
  registerFrequencyTools(server, client);

  return server;
}
