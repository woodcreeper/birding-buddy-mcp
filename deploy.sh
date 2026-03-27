#!/usr/bin/env bash
set -euo pipefail

echo "=== Birding Buddy MCP — Deploy to Cloudflare ==="
echo ""

# Check for npx/wrangler
if ! command -v npx &> /dev/null; then
  echo "Error: npx not found. Install Node.js first: https://nodejs.org"
  exit 1
fi

# Check Cloudflare auth
echo "Checking Cloudflare authentication..."
if ! npx wrangler whoami &> /dev/null; then
  echo "Not logged in. Opening browser for Cloudflare login..."
  npx wrangler login
fi
echo ""

# Create KV namespace if needed
echo "Setting up KV namespace for life list storage..."
KV_OUTPUT=$(npx wrangler kv namespace list 2>/dev/null || echo "[]")

if echo "$KV_OUTPUT" | grep -q "LIFE_LIST_KV"; then
  echo "KV namespace already exists."
  KV_ID=$(echo "$KV_OUTPUT" | grep -B2 "LIFE_LIST_KV" | grep '"id"' | head -1 | sed 's/.*"id": *"\([^"]*\)".*/\1/')
else
  echo "Creating KV namespace..."
  CREATE_OUTPUT=$(npx wrangler kv namespace create LIFE_LIST_KV 2>&1)
  KV_ID=$(echo "$CREATE_OUTPUT" | grep 'id = ' | sed 's/.*id = "\([^"]*\)".*/\1/')
  echo "Created KV namespace: $KV_ID"
fi

# Update wrangler.toml with the KV ID
if [ -n "$KV_ID" ]; then
  cat > wrangler.toml << EOF
name = "birding-buddy"
main = "dist/worker.js"
compatibility_date = "2025-01-01"
compatibility_flags = ["nodejs_compat"]

[[kv_namespaces]]
binding = "LIFE_LIST_KV"
id = "$KV_ID"
EOF
  echo "Updated wrangler.toml with KV namespace ID."
fi
echo ""

# Set secrets
echo "=== API Keys ==="
echo "Your API keys are stored as Cloudflare secrets — they never appear in code."
echo ""

read -p "eBird API key (required — get one at https://ebird.org/api/keygen): " EBIRD_KEY
if [ -z "$EBIRD_KEY" ]; then
  echo "Error: eBird API key is required."
  exit 1
fi
echo "$EBIRD_KEY" | npx wrangler secret put EBIRD_API_KEY
echo ""

read -p "Xeno-canto API key (optional — press Enter to skip): " XC_KEY
if [ -n "$XC_KEY" ]; then
  echo "$XC_KEY" | npx wrangler secret put XC_API_KEY
  echo ""
fi

# Build and deploy
echo ""
echo "Building and deploying..."
npm run build:worker
npx wrangler deploy

echo ""
echo "=== Done! ==="
echo ""
echo "Your Birding Buddy server is live. Add it to Claude:"
echo ""
echo "  1. Open Claude → Settings → MCP Servers (or Integrations)"
echo "  2. Add a new remote server with your URL (shown above)"
echo "  3. Start birding! Try: 'What birds have been seen near Cape May, NJ?'"
echo ""
echo "To import your life list:"
echo "  1. Go to https://ebird.org/lifelist and click Download (CSV)"
echo "  2. In Claude, say 'Import my eBird life list' and paste the CSV content"
