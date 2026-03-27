#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { LocalLifeListStore } from "./data/local-store.js";

const apiKey = process.env.EBIRD_API_KEY;
if (!apiKey) {
  console.error("Error: EBIRD_API_KEY environment variable is required.");
  console.error("Get your key at: https://ebird.org/api/keygen");
  process.exit(1);
}

const xcApiKey = process.env.XC_API_KEY;
if (!xcApiKey) {
  console.error(
    "Note: XC_API_KEY not set — Xeno-canto enrichment tools will be unavailable."
  );
  console.error(
    "Get your key at: https://xeno-canto.org (requires verified account)"
  );
}

const server = createServer(apiKey, xcApiKey, new LocalLifeListStore());
const transport = new StdioServerTransport();
await server.connect(transport);
