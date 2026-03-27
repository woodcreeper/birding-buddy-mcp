import { createServer } from "./server.js";
import { KVLifeListStore } from "./data/kv-store.js";

interface Env {
  EBIRD_API_KEY: string;
  XC_API_KEY?: string;
  LIFE_LIST_KV: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Only accept POST to /mcp (and GET for SSE, DELETE for session close)
    const url = new URL(request.url);
    if (url.pathname !== "/mcp") {
      return new Response("Not found. MCP endpoint is at /mcp", { status: 404 });
    }

    if (!env.EBIRD_API_KEY) {
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32603, message: "EBIRD_API_KEY not configured" },
          id: null,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    try {
      // Dynamic import to avoid bundling issues with Node.js-specific code
      const { WebStandardStreamableHTTPServerTransport } = await import(
        "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
      );

      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // Stateless mode for Workers
        enableJsonResponse: true, // Return JSON instead of SSE for stateless mode
      });

      const store = new KVLifeListStore(env.LIFE_LIST_KV);
      const server = createServer(env.EBIRD_API_KEY, env.XC_API_KEY, store);
      await server.connect(transport);

      return await transport.handleRequest(request);
    } catch (error) {
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: error instanceof Error ? error.message : "Internal server error",
          },
          id: null,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  },
};
