import { createServer } from "./server.js";
import { KVLifeListStore } from "./data/kv-store.js";
import { parseCsv } from "./data/life-list.js";

interface Env {
  EBIRD_API_KEY: string;
  XC_API_KEY?: string;
  LIFE_LIST_KV: KVNamespace;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function uploadFormHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Birding Buddy — Upload Life List</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f5f7f5; color: #2d3436; padding: 2rem 1rem; }
    .container { max-width: 520px; margin: 0 auto; }
    h1 { font-size: 1.6rem; margin-bottom: 0.5rem; }
    .subtitle { color: #636e72; margin-bottom: 2rem; }
    .card { background: white; border-radius: 12px; padding: 2rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .steps { margin-bottom: 1.5rem; }
    .steps li { margin-bottom: 0.5rem; line-height: 1.5; }
    .steps a { color: #0984e3; }
    label { display: block; font-weight: 600; margin-bottom: 0.5rem; }
    input[type="file"] { display: block; width: 100%; padding: 0.75rem; border: 2px dashed #b2bec3; border-radius: 8px; background: #fafafa; cursor: pointer; margin-bottom: 1rem; }
    input[type="file"]:hover { border-color: #0984e3; }
    button { background: #00b894; color: white; border: none; padding: 0.75rem 2rem; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer; width: 100%; }
    button:hover { background: #00a381; }
    button:disabled { background: #b2bec3; cursor: not-allowed; }
    .result { margin-top: 1.5rem; padding: 1rem; border-radius: 8px; }
    .result.success { background: #d4edda; color: #155724; }
    .result.error { background: #f8d7da; color: #721c24; }
    .result h2 { font-size: 1.1rem; margin-bottom: 0.5rem; }
    .result p { margin-bottom: 0.25rem; }
    .spinner { display: none; margin: 1rem auto; width: 24px; height: 24px; border: 3px solid #dfe6e9; border-top-color: #00b894; border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="container">
    <h1>Birding Buddy</h1>
    <p class="subtitle">Upload your eBird life list</p>
    <div class="card">
      <ol class="steps">
        <li>Go to <a href="https://ebird.org/downloadMyData" target="_blank" rel="noopener">ebird.org/downloadMyData</a></li>
        <li>Click <strong>Download</strong> to get your CSV file</li>
        <li>Upload it below</li>
      </ol>
      <form id="upload-form" enctype="multipart/form-data">
        <label for="csv">Choose your eBird CSV file</label>
        <input type="file" id="csv" name="csv" accept=".csv" required>
        <button type="submit" id="submit-btn">Upload Life List</button>
      </form>
      <div class="spinner" id="spinner"></div>
      <div id="result"></div>
    </div>
  </div>
  <script>
    function showResult(isSuccess, heading, lines) {
      var resultDiv = document.getElementById('result');
      resultDiv.textContent = '';

      var container = document.createElement('div');
      container.className = 'result ' + (isSuccess ? 'success' : 'error');

      var h2 = document.createElement('h2');
      h2.textContent = heading;
      container.appendChild(h2);

      for (var i = 0; i < lines.length; i++) {
        var p = document.createElement('p');
        p.textContent = lines[i];
        container.appendChild(p);
      }

      resultDiv.appendChild(container);
    }

    var form = document.getElementById('upload-form');
    var spinner = document.getElementById('spinner');
    var submitBtn = document.getElementById('submit-btn');

    form.addEventListener('submit', function(e) {
      e.preventDefault();
      var fileInput = document.getElementById('csv');
      if (!fileInput.files.length) return;

      submitBtn.disabled = true;
      spinner.style.display = 'block';
      document.getElementById('result').textContent = '';

      var formData = new FormData();
      formData.append('csv', fileInput.files[0]);

      fetch('/upload', { method: 'POST', body: formData })
        .then(function(resp) { return resp.json(); })
        .then(function(data) {
          if (data.success) {
            showResult(true, 'Life list imported!', [
              data.totalSpecies + ' species from ' + data.countries + ' countries saved.',
              'Your life list is now available in Claude across all sessions.'
            ]);
          } else {
            showResult(false, 'Import failed', [data.error || 'Unknown error']);
          }
        })
        .catch(function(err) {
          showResult(false, 'Upload failed', [err.message]);
        })
        .finally(function() {
          submitBtn.disabled = false;
          spinner.style.display = 'none';
        });
    });
  </script>
</body>
</html>`;
}

async function handleCsvUpload(request: Request, env: Env): Promise<Response> {
  try {
    let csvContent: string;
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("csv") as unknown as File | null;
      if (!file) {
        return new Response(
          JSON.stringify({ success: false, error: "No CSV file provided" }),
          { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
        );
      }
      csvContent = await file.text();
    } else {
      csvContent = await request.text();
    }

    if (!csvContent.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: "Empty CSV content" }),
        { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    const { species, countries } = parseCsv(csvContent);
    const store = new KVLifeListStore(env.LIFE_LIST_KV);
    await store.save({ species });

    const result = {
      success: true,
      totalSpecies: Object.keys(species).length,
      countries: countries.size,
    };

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : "Upload failed";
    return new Response(
      JSON.stringify({ success: false, error }),
      { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Life list upload endpoints
    if (url.pathname === "/upload") {
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
      }
      if (request.method === "GET") {
        return new Response(uploadFormHtml(), {
          headers: { "Content-Type": "text/html", ...CORS_HEADERS },
        });
      }
      if (request.method === "POST") {
        return handleCsvUpload(request, env);
      }
      return new Response("Method not allowed", { status: 405 });
    }

    // MCP endpoint
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
      const server = createServer(env.EBIRD_API_KEY, env.XC_API_KEY, store, { hasUploadEndpoint: true });
      await server.connect(transport);

      const response = await transport.handleRequest(request);
      await server.close();
      return response;
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
