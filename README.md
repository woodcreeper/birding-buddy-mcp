# Birding Buddy MCP

Your AI-powered birding companion. A TypeScript [MCP](https://modelcontextprotocol.io/) server that connects Claude to the [eBird API](https://documenter.getpostman.com/view/664302/S1ENwy59), [Macaulay Library](https://www.macaulaylibrary.org/), and [Xeno-canto](https://xeno-canto.org/) — with personal intelligence like life list tracking, route-based hotspot discovery, media gap analysis, and Xeno-canto recording enrichment.

**23 tools** across 5 categories: core eBird API, life list management, compound intelligence, Xeno-canto enrichment, and utilities.

The server includes a **Birding Buddy** persona — always-active instructions that tell Claude how to route your questions to the right tools, group results by bird category, highlight rarities, and offer recording gap analysis when relevant. Just talk naturally.

---

## Why build this?

Existing eBird MCP servers are thin API wrappers — they give Claude access to eBird data, but they don't know anything about *you*. This server adds a personal layer:

- **Your life list** — imported from eBird's CSV export, so every query can filter for species you haven't seen
- **Route intelligence** — finds birding hotspots along a driving route, not just near a single point
- **Media gap discovery** — surfaces species with the fewest photos and recordings, so you can contribute where it matters most
- **Recording enrichment** — checks Xeno-canto for species with the fewest quality recordings, so you can target your sound recording efforts

The eBird API provides the raw data. Claude provides the intelligence — it already knows which species are endemic, how to prioritize a birding itinerary, and how to reason about detection probability. This server bridges the two.

---

## Setup

### 1. Get your API keys

- **eBird API key** (required) — go to [ebird.org/api/keygen](https://ebird.org/api/keygen) and request a key (free, instant).
- **Xeno-canto API key** (optional) — register at [xeno-canto.org](https://xeno-canto.org), verify your email, then find your key on your account page. Enables recording gap analysis.

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and add your keys:

```
EBIRD_API_KEY=your-ebird-key-here
XC_API_KEY=your-xeno-canto-key-here
```

The Xeno-canto key is optional — if omitted, all eBird tools work normally but the Xeno-canto enrichment tools will return a helpful error message.

### 3. Clone and build

```bash
git clone https://github.com/woodcreeper/birding-buddy-mcp.git
cd birding-buddy-mcp
npm install
npm run build
```

### 4. Add to Claude Desktop

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

### 5. Import your life list

1. Go to [My eBird → Download My Data](https://ebird.org/downloadMyData)
2. Download the CSV file
3. Open Claude Desktop and say:

> Import my eBird life list from `/Users/you/Downloads/MyEBirdData.csv`

You'll see a confirmation with your total species count and number of countries.

---

## Your Life List — The Killer Feature

Your life list is what makes this server different from every other eBird tool. Once imported, it powers all the "intelligence" tools — turning generic queries like "what birds are here?" into personal ones like "what birds are here that *I* haven't seen?"

### How it works

1. **Import once** — the `import_life_list` tool parses your eBird CSV and stores it locally at `~/.ebird-mcp/life-list.json`. This file persists across Claude sessions. You don't need to re-import every time you open Claude.

2. **Automatic filtering** — the compound tools (`get_life_list_gaps_nearby`, `get_life_list_gaps_at_hotspot`) automatically cross-reference live eBird observations against your life list. Species you've already seen are filtered out; what remains are your potential lifers, ranked by how frequently they're being reported.

3. **Re-import to refresh** — after a trip where you added new species, re-download your CSV from eBird and re-import. The new file overwrites the old one. Your life list is always as current as your last import.

### What's in the CSV?

eBird's "Download My Data" CSV contains every observation you've ever submitted: species, date, location, count, and more. The server extracts the unique species and keeps the earliest observation date for each — that's your life list. It deduplicates by scientific name, so subspecies and regional forms are handled correctly.

### What you can ask

| Question | What happens |
|----------|-------------|
| "What lifers can I get near me?" | Queries nearby observations, filters against your life list, ranks by report frequency |
| "Is Resplendent Quetzal on my life list?" | Looks up the species by scientific name in your local data |
| "How many species have I seen?" | Summarizes your list with breakdowns by country and year |
| "What haven't I seen at this hotspot?" | Gets recent observations at the hotspot, removes species you've seen |
| "What new birds could I find on my drive from A to B?" | Finds hotspots along the route, then filters each for your life list gaps |

### Life list data stays local

Your life list never leaves your machine. It's stored as a JSON file in `~/.ebird-mcp/` and is only read by the MCP server running on your computer. No data is sent to any external service — the eBird API is only queried for *public* observation data, never your personal data.

---

## Media Gap Discovery — Macaulay Library

The `get_media_gaps` tool helps you find species that are under-documented — the ones with the fewest photos, audio recordings, or videos. This is for birders who want to *contribute*, not just consume.

**Important:** This tool is most useful for under-birded regions (e.g., MX-ROO, small island nations). For well-birded regions like the US or UK, the results are meaningless since virtually all species have extensive media coverage.

### How it works

1. **Gets the species list** for your chosen region from the eBird API
2. **Queries Macaulay Library** for each species — counts photos, audio recordings, and videos using the same `taxonCode` that eBird uses
3. **Sorts** results by total media count, ascending — species with the least coverage float to the top

### Rate limiting and performance

- **Macaulay Library** — ~2-3 requests/sec (the API is undocumented but stable; we're conservative)

For the default 50 species, this takes about **20 seconds**. You can increase `maxSpecies` up to 200, but expect 1-2 minutes for larger queries.

### Fallback behavior

Macaulay Library's API is undocumented — it works reliably today, but there's no official stability guarantee. If it goes down, the tool will return an error rather than silent empty results.

---

## Xeno-canto Recording Enrichment

After Claude presents a species list from any observation query, it will offer to check Xeno-canto for recording gaps. This two-stage workflow keeps initial queries fast and respects Xeno-canto's API.

### How it works

1. Claude presents a species list (from `get_nearby_observations`, `get_life_list_gaps_nearby`, etc.)
2. Claude asks: *"Want me to check which of these have the fewest quality recordings on Xeno-canto?"*
3. If you say yes, it calls `enrich_species_list` — which queries Xeno-canto for each species and returns them sorted by fewest A-grade recordings
4. The top recording targets are presented with quality grade breakdowns (A through E)

### What you can ask

| Question | What happens |
|----------|-------------|
| "Yes, check Xeno-canto" (after a species list) | Enriches the list with XC recording counts, sorted by contribution priority |
| "How many recordings does [species] have?" | Calls `get_recording_counts` for a single species |

### Rate limiting

Xeno-canto is queried at ~5 requests/sec (200ms delay between calls). For 50 species, expect about 10 seconds. The tool warns you before processing large lists.

### API key required

Xeno-canto enrichment requires an API key (free with a verified account). See [Setup](#setup) for configuration. If the key is not configured, the enrichment tools return a helpful error message — all other tools continue working normally.

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

### Media Contribution — "Where can I contribute recordings?"

> **You:** I'm doing sound recordings in Quintana Roo. What species here have the fewest media records?
>
> **Claude:** *(calls `get_media_gaps` with regionCode MX-ROO, mediaType audio)*
>
> Here are species in Quintana Roo with the fewest audio recordings:
>
> 1. **Yucatan Poorwill** — 0 photos, 0 audio, 0 video | Total: 0
> 2. **Cozumel Vireo** — 1 photo, 1 audio, 0 video | Total: 2
> 3. ...
>
> Want me to check which of these have the fewest quality recordings on Xeno-canto? I can flag the best targets for contributing new recordings.

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

## Tools Reference (23 total)

### Core eBird API (12 tools)

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
| `get_taxonomy` | Species taxonomy lookup | `species` (codes), `locale` |
| `get_species_list` | All species ever recorded in a region | `regionCode` |

### Life List (3 tools)

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `import_life_list` | Import your eBird CSV export | `csvPath` |
| `check_life_list` | Check if a species is on your list | `scientificName` |
| `get_life_list_stats` | Summary: total species, by country, by year | — |

### Compound Intelligence (4 tools)

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `get_life_list_gaps_nearby` | Find potential lifers near your location | `lat`, `lng`, `dist`, `back` |
| `get_life_list_gaps_at_hotspot` | Species at a hotspot not on your life list | `locId`, `back` |
| `get_hotspots_along_route` | Birding stops along a driving route (uses OSRM) | `startLat/Lng`, `endLat/Lng`, `hotspotRadius` |
| `get_media_gaps` | Species with fewest media records (Macaulay only, under-birded regions) | `regionCode`, `maxSpecies`, `mediaType` |

### Xeno-canto Enrichment (2 tools)

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `get_recording_counts` | Recording count by quality grade (A-E) for a species | `speciesName`, `country` |
| `enrich_species_list` | Batch XC enrichment, sorted by fewest A-grade recordings | `species` (array), `country` |

### Utility (2 tools)

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `resolve_region_code` | Fuzzy match place names to eBird region codes | `placeName` |
| `get_observation_frequency` | Estimate detection probability for a species/date | `regionCode`, `speciesCode`, `month`, `day` |

---

## How It Works

```
You → Claude Desktop → MCP Protocol → birding-buddy-mcp server
                                          ├── eBird API 2.0 (observations, hotspots, taxonomy)
                                          ├── OSRM (driving routes)
                                          ├── Macaulay Library (photo/audio/video counts)
                                          ├── Xeno-canto API v3 (recording counts by quality grade)
                                          └── Local life list (~/.ebird-mcp/life-list.json)
```

The server handles all API calls and data plumbing. Claude handles the intelligence — it knows endemic species, understands birding priorities, and can synthesize data from multiple tools into trip plans and recommendations.

The **Birding Buddy** persona (delivered via MCP server instructions) tells Claude how to route your questions, present results grouped by bird category, and offer Xeno-canto enrichment at the right time.

### External APIs

| API | Purpose | Auth | Rate Limits |
|-----|---------|------|-------------|
| [eBird API 2.0](https://documenter.getpostman.com/view/664302/S1ENwy59) | Observations, hotspots, taxonomy | API key | ~200 req/hr |
| [OSRM](http://project-osrm.org/) | Driving route calculation | None | Fair use (public demo server) |
| [Macaulay Library](https://www.macaulaylibrary.org/) | Media asset counts | None | ~2-3 req/sec |
| [Xeno-canto API v3](https://xeno-canto.org/explore/api) | Recording counts by quality grade | API key | Fair use |

### Life List Storage

Your life list is stored locally at `~/.ebird-mcp/life-list.json`. It's a JSON file keyed by scientific name, containing common name, first observation date, and country. Re-import anytime to refresh.

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
npm install          # Install dependencies
npm run build        # Compile TypeScript
npm run dev          # Watch mode (recompiles on save)
npm start            # Run the server (needs EBIRD_API_KEY env var)
```

### Project Structure

```
src/
├── index.ts              # Entry point (stdio transport)
├── server.ts             # MCP server setup, registers all tools
├── clients/
│   ├── ebird.ts          # eBird API 2.0 client (typed)
│   ├── osrm.ts           # OSRM routing client
│   ├── macaulay.ts       # Macaulay Library search client
│   └── xeno-canto.ts     # Xeno-canto API v3 client
├── prompts/
│   └── birding-buddy.ts  # Birding Buddy persona instructions
├── data/
│   └── life-list.ts      # Life list CSV import and storage
├── tools/
│   ├── observations.ts   # 7 observation tools
│   ├── hotspots.ts       # 3 hotspot tools
│   ├── taxonomy.ts       # 2 taxonomy tools
│   ├── reference.ts      # 3 reference + region resolver tools
│   ├── life-list.ts      # 3 life list tools
│   ├── compound.ts       # 3 compound intelligence tools
│   ├── media.ts          # 1 media gap tool
│   ├── xeno-canto.ts     # 2 Xeno-canto enrichment tools
│   └── frequency.ts      # 1 frequency estimation tool
└── utils/
    ├── geo.ts            # Haversine distance, waypoint sampling
    └── region-resolver.ts # Fuzzy region code matching
```

---

## License

MIT
