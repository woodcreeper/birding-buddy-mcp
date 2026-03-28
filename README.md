# Birding Buddy MCP

Your AI-powered birding companion. A TypeScript [MCP](https://modelcontextprotocol.io/) server that connects Claude to the [eBird API](https://documenter.getpostman.com/view/664302/S1ENwy59) and [Xeno-canto](https://xeno-canto.org/) — with personal intelligence like life list tracking, route-based hotspot discovery, and Xeno-canto recording enrichment.

**28 tools** across 6 categories: core eBird API, hotspot & checklist access, life list management, compound intelligence, Xeno-canto enrichment, and utilities.

The server includes a **Birding Buddy** persona — always-active instructions that tell Claude how to route your questions to the right tools, group results by bird category, highlight rarities, and offer recording gap analysis when relevant. Just talk naturally.

---

## Quick Deploy — Cloudflare Workers (Recommended)

Deploy your own Birding Buddy server in under 5 minutes. Works with Claude Desktop, Claude.ai, and the Claude mobile app.

### What you'll need

- A free [Cloudflare account](https://dash.cloudflare.com/sign-up)
- An **eBird API key** (free, instant) — [ebird.org/api/keygen](https://ebird.org/api/keygen)
- A **Xeno-canto API key** (optional, free) — register at [xeno-canto.org](https://xeno-canto.org), verify your email, find your key on your account page

### Deploy

```bash
git clone https://github.com/woodcreeper/birding-buddy-mcp.git
cd birding-buddy-mcp
npm install
./deploy.sh
```

The deploy script will:
1. Log you into Cloudflare (if needed)
2. Create a KV namespace for your life list
3. Prompt for your eBird and Xeno-canto API keys (stored as Cloudflare secrets — never in code)
4. Build and deploy the Worker

When it finishes, you'll see your server URL:

```
https://birding-buddy.<your-subdomain>.workers.dev/mcp
```

### Connect to Claude

**Claude Desktop / Claude.ai / Claude mobile:**

Add your server URL as a remote MCP server:
1. Open Claude → Settings → MCP Servers (or Integrations)
2. Add a new server with the URL from the deploy step
3. That's it — Birding Buddy tools appear automatically

### Import your life list

1. Go to [ebird.org/lifelist](https://ebird.org/lifelist)
2. Click **Download (CSV)**
3. In Claude, say: *"Import my eBird life list"* and paste the CSV content

Your life list is stored in your own Cloudflare KV namespace — private to you, accessible from any device.

---

## Local Setup (Claude Desktop only)

If you prefer to run the server locally instead of on Cloudflare:

### 1. Get your API keys

- **eBird API key** (required) — [ebird.org/api/keygen](https://ebird.org/api/keygen)
- **Xeno-canto API key** (optional) — [xeno-canto.org](https://xeno-canto.org)

### 2. Clone and build

```bash
git clone https://github.com/woodcreeper/birding-buddy-mcp.git
cd birding-buddy-mcp
npm install
npm run build
```

### 3. Add to Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ebird": {
      "command": "node",
      "args": ["/absolute/path/to/birding-buddy-mcp/dist/index.js"],
      "env": {
        "EBIRD_API_KEY": "your-ebird-key-here",
        "XC_API_KEY": "your-xeno-canto-key-here"
      }
    }
  }
}
```

Restart Claude Desktop after saving.

### 4. Import your life list

1. Go to [ebird.org/lifelist](https://ebird.org/lifelist) and click **Download (CSV)**
2. In Claude, say:

> Import my eBird life list from `/Users/you/Downloads/ebird_world_life_list.csv`

Your life list is stored locally at `~/.ebird-mcp/life-list.json` and persists across Claude sessions.

---

## Why build this?

Existing eBird MCP servers are thin API wrappers — they give Claude access to eBird data, but they don't know anything about *you*. This server adds a personal layer:

- **Your life list** — imported from eBird's CSV export, so every query can filter for species you haven't seen
- **Route intelligence** — finds birding hotspots along a driving route, not just near a single point
- **Recording enrichment** — checks Xeno-canto for species with the fewest quality recordings, so you can target your sound recording efforts
- **Checklist access** — resolve hotspots by name, browse recent checklists, and view full species lists — with direct eBird links throughout

The eBird API provides the raw data. Claude provides the intelligence — it already knows which species are endemic, how to prioritize a birding itinerary, and how to reason about detection probability. This server bridges the two.

---

## Your Life List — The Killer Feature

Your life list is what makes this server different from every other eBird tool. Once imported, it powers all the "intelligence" tools — turning generic queries like "what birds are here?" into personal ones like "what birds are here that *I* haven't seen?"

### How it works

1. **Import once** — the `import_life_list` tool parses your eBird life list CSV. On Cloudflare, it's stored in your personal KV namespace. Locally, it's saved at `~/.ebird-mcp/life-list.json`. Either way, it persists across sessions — you don't need to re-import every time.

2. **Automatic filtering** — the compound tools (`get_life_list_gaps_nearby`, `get_life_list_gaps_at_hotspot`) automatically cross-reference live eBird observations against your life list. Species you've already seen are filtered out; what remains are your potential lifers, ranked by how frequently they're being reported.

3. **Re-import to refresh** — after a trip where you added new species, re-download your CSV from eBird and re-import. The new file overwrites the old one.

### What you can ask

| Question | What happens |
|----------|-------------|
| "What lifers can I get near me?" | Queries nearby observations, filters against your life list, ranks by report frequency |
| "Is Resplendent Quetzal on my life list?" | Looks up the species by scientific name |
| "How many species have I seen?" | Summarizes your list with breakdowns by country and year |
| "What haven't I seen at this hotspot?" | Gets recent observations at the hotspot, removes species you've seen |
| "What new birds could I find on my drive from A to B?" | Finds hotspots along the route, then filters each for your life list gaps |

---

## Example Conversations

These are real things you can say to Claude once the server is running. Claude will call the appropriate tools automatically.

### Roadside Birding — "I've got 30 minutes, what can I find?"

> **You:** I'm at a rest stop near Merida, Mexico (20.97, -89.62). What birds nearby would be lifers for me?
>
> **Claude:** *(calls `get_life_list_gaps_nearby` with your coordinates)*
>
> I found 12 potential lifers within 25km of your location. Here are the top targets:
>
> - **Yucatan Woodpecker** — 8 recent reports, nearest at Parque Centenario
> - **Turquoise-browed Motmot** — 6 reports, nearest at Reserva Ecológica Cuxtal
> - **Orange Oriole** — 4 reports, nearest at Hacienda Temozon
> - ...

### Trip Route Planning — "Help me plan my drive"

> **You:** We're landing in Cancun on April 5th and driving to Progreso. Find me the best birding stops along the route, especially for Yucatan endemics.
>
> **Claude:** *(calls `get_hotspots_along_route` with Cancun → Progreso coordinates, then cross-references results with your life list)*
>
> Route: 312 km, ~3.5 hour drive. I found 47 hotspots along your route. Here are the top stops ranked by species richness:
>
> 1. **Reserva de la Biosfera Ria Lagartos** [L1234567] — 287 species all-time
> 2. **Cenote Ik Kil** [L2345678] — 156 species
> 3. ...
>
> For Yucatan endemics specifically, I'd prioritize stops 1 and 5 — both have recent reports of Yucatan Wren, Yucatan Jay, and Orange Oriole. These are all species you haven't seen.

### At a Hotspot — "What should I look for here?"

> **You:** I'm at Celestun Biosphere Reserve (L456789). What species here would be new for my life list? Prioritize endemics.
>
> **Claude:** *(calls `get_life_list_gaps_at_hotspot`)*
>
> 23 species recently reported here that aren't on your life list:
>
> **Yucatan endemics / near-endemics you should target:**
> - Mexican Sheartail (4 recent reports)
> - Yucatan Wren (7 recent reports)
> - Yellow-lored Parrot (2 recent reports)
>
> **Other lifers with good recent detection:**
> - American Flamingo (12 reports)
> - Clapper Rail (3 reports)
> - ...

### Life List Stats — "How am I doing?"

> **You:** Give me a summary of my life list — how many species, which countries, best years.
>
> **Claude:** *(calls `get_life_list_stats`)*
>
> **Life List Summary**
> Total species: 847
>
> By country:
> - United States: 612
> - Mexico: 198
> - Costa Rica: 145
> - ...
>
> By year:
> - 2024: 89 new species
> - 2023: 67 new species
> - ...

### Species Lookup — "Tell me about this bird"

> **You:** What's the eBird species code for Resplendent Quetzal? And is it on my life list?
>
> **Claude:** *(calls `get_taxonomy` then `check_life_list`)*
>
> Resplendent Quetzal (*Pharomachrus mocinno*) — species code: `resque1`, Family: Trogonidae.
>
> Not on your life list — this would be a lifer!

### Detection Probability — "Is this the right time?"

> **You:** What are the chances of seeing a Painted Bunting in coastal South Carolina in mid-April?
>
> **Claude:** *(calls `resolve_region_code` for SC, then `get_observation_frequency`)*
>
> Painted Bunting in US-SC around April 15:
> Detected in 2/3 years checked (67%)
> Likelihood: Likely
>
> Mid-April is right at the start of their breeding season arrival. You should have good odds, especially at coastal scrub and marsh edge habitats.

### Exploring a New Region — "What's birding like there?"

> **You:** I'm thinking about a trip to Oaxaca. How many species have been recorded there? What are the top hotspots?
>
> **Claude:** *(calls `get_species_list` for MX-OAX, then `get_hotspots_in_region`)*
>
> Oaxaca has 764 species recorded — one of the most biodiverse states in Mexico.
>
> Top hotspots by all-time species count:
> 1. Teotitlan del Valle Road (342 species)
> 2. Huatulco National Park (289 species)
> 3. ...

---

## Tools Reference (28 total)

### Core eBird API (13 tools)

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `get_recent_observations` | Recent sightings in a region | `regionCode`, `back` (days), `maxResults` |
| `get_notable_observations` | Rare/unusual sightings in a region | `regionCode`, `back` |
| `get_nearby_observations` | Sightings near a lat/lng | `lat`, `lng`, `dist` (km) |
| `get_nearby_notable_observations` | Rarities near a location | `lat`, `lng`, `dist` |
| `get_observations_for_species` | Sightings of one species in a region | `regionCode`, `speciesCode` |
| `get_nearest_observations_for_species` | Closest sighting of a species | `speciesCode`, `lat`, `lng` |
| `get_historic_observations` | Sightings on a specific date | `regionCode`, `year`, `month`, `day` |
| `get_hotspots_in_region` | Birding hotspots in a region | `regionCode`, `back` |
| `get_nearby_hotspots` | Hotspots near a lat/lng | `lat`, `lng`, `dist` |
| `get_hotspot_info` | Details for a specific hotspot | `locId` |
| `resolve_hotspot` | Find a hotspot by name (fuzzy match) | `name`, `lat`, `lng`, `dist` |
| `get_taxonomy` | Species taxonomy lookup | `species` (codes), `locale` |
| `get_species_list` | All species ever recorded in a region | `regionCode` |

### Checklist Access (3 tools)

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `get_hotspot_observations` | Recent observations at a specific hotspot | `locId`, `back`, `maxResults` |
| `get_recent_checklists` | Recent checklists at a hotspot, region, or near a location | `locId`, `regionCode`, or `lat`+`lng` |
| `view_checklist` | Full species list for a specific checklist | `subId` |

### Life List (3 tools)

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `import_life_list` | Import your eBird life list CSV | `csvPath` or `csvContent` |
| `check_life_list` | Check if a species is on your list | `scientificName` |
| `get_life_list_stats` | Summary: total species, by country, by year | — |

### Compound Intelligence (3 tools)

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `get_life_list_gaps_nearby` | Find potential lifers near your location | `lat`, `lng`, `dist`, `back` |
| `get_life_list_gaps_at_hotspot` | Species at a hotspot not on your life list | `locId`, `back` |
| `get_hotspots_along_route` | Birding stops along a driving route (uses OSRM) | `startLat/Lng`, `endLat/Lng`, `hotspotRadius` |

### Xeno-canto Enrichment (2 tools)

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `get_recording_counts` | Recording count by quality grade (A-E) for a species | `speciesName`, `country` |
| `enrich_species_list` | Batch XC enrichment, sorted by fewest A-grade recordings | `species` (array), `country` |

### Reference & Utility (5 tools)

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `get_region_info` | Details about an eBird region | `regionCode` |
| `get_sub_regions` | Sub-regions within a region | `regionCode`, `regionType` |
| `resolve_region_code` | Fuzzy match place names to eBird region codes | `placeName` |
| `get_observation_frequency` | Estimate detection probability for a species/date | `regionCode`, `speciesCode`, `month`, `day` |

---

## How It Works

```
You → Claude → MCP Protocol → Birding Buddy server (local or Cloudflare Worker)
                                   ├── eBird API 2.0 (observations, hotspots, taxonomy)
                                   ├── OSRM (driving routes)
                                   ├── Xeno-canto API v3 (recording counts by quality grade)
                                   └── Your life list (Cloudflare KV or local JSON file)
```

The server handles all API calls and data plumbing. Claude handles the intelligence — it knows endemic species, understands birding priorities, and can synthesize data from multiple tools into trip plans and recommendations.

The **Birding Buddy** persona (delivered via MCP server instructions) tells Claude how to route your questions, present results grouped by bird category, and offer Xeno-canto enrichment at the right time.

### External APIs

| API | Purpose | Auth | Rate Limits |
|-----|---------|------|-------------|
| [eBird API 2.0](https://documenter.getpostman.com/view/664302/S1ENwy59) | Observations, hotspots, taxonomy | API key | ~200 req/hr |
| [OSRM](http://project-osrm.org/) | Driving route calculation | None | Fair use (public demo server) |
| [Xeno-canto API v3](https://xeno-canto.org/explore/api) | Recording counts by quality grade | API key | Fair use |

---

## eBird Region Codes

Many tools accept an eBird region code. Common formats:

| Level | Format | Example |
|-------|--------|---------|
| Country | 2-letter ISO | `US`, `MX`, `CR`, `BR` |
| State/Province | Country-State | `US-NY`, `MX-ROO`, `CA-ON` |
| County | Country-State-County | `US-NY-061` |

Don't know the code? Use the `resolve_region_code` tool — just say "What's the region code for Quintana Roo?" and Claude will look it up.

---

## Development

```bash
npm install              # Install dependencies
npm run build            # Compile TypeScript (local server)
npm run build:worker     # Compile TypeScript (Cloudflare Worker)
npm run dev              # Watch mode (recompiles on save)
npm run deploy           # Build worker + deploy to Cloudflare
npm start                # Run locally (needs EBIRD_API_KEY env var)
```

### Project Structure

```
src/
├── index.ts              # Local entry point (stdio transport)
├── worker.ts             # Cloudflare Worker entry point
├── server.ts             # MCP server setup, registers all tools
├── clients/
│   ├── ebird.ts          # eBird API 2.0 client (typed)
│   ├── osrm.ts           # OSRM routing client
│   └── xeno-canto.ts     # Xeno-canto API v3 client
├── prompts/
│   └── birding-buddy.ts  # Birding Buddy persona instructions
├── data/
│   ├── life-list.ts      # Life list CSV parsing and core logic
│   ├── local-store.ts    # Local filesystem storage (~/.ebird-mcp/)
│   └── kv-store.ts       # Cloudflare KV storage
├── tools/
│   ├── observations.ts   # 7 observation tools
│   ├── hotspots.ts       # 4 hotspot tools (incl. resolve_hotspot)
│   ├── checklists.ts     # 3 checklist access tools
│   ├── taxonomy.ts       # 2 taxonomy tools
│   ├── reference.ts      # 3 reference + region resolver tools
│   ├── life-list.ts      # 3 life list tools
│   ├── compound.ts       # 3 compound intelligence tools
│   ├── xeno-canto.ts     # 2 Xeno-canto enrichment tools
│   └── frequency.ts      # 1 frequency estimation tool
└── utils/
    ├── geo.ts            # Haversine distance, waypoint sampling
    └── region-resolver.ts # Fuzzy region code matching
```

---

## License

MIT
