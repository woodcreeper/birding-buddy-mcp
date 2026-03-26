#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

const apiKey = process.env.EBIRD_API_KEY;
if (!apiKey) {
  console.error("Error: EBIRD_API_KEY environment variable is required.");
  console.error("Get your key at: https://ebird.org/api/keygen");
  process.exit(1);
}

const server = createServer(apiKey);
const transport = new StdioServerTransport();
await server.connect(transport);
