# eBird MCP Server — "Birding Buddy"

Your AI-powered birding companion. A TypeScript MCP server that wraps the eBird API and adds personal intelligence — life list tracking, route-based hotspot discovery, and media gap analysis.

## What it does

Ask Claude things like:
- "What birds can I add to my life list within 10km of here?"
- "Find birding stops between Cancun and Progreso for the first week of April"
- "What species at this hotspot have the fewest audio recordings in eBird?"

## Setup

### 1. Get an eBird API key
Go to https://ebird.org/api/keygen and sign up.

### 2. Install
```bash
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
      "args": ["/absolute/path/to/nashville/dist/index.js"],
      "env": {
        "EBIRD_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### 4. Import your life list
1. Go to [My eBird → Download My Data](https://ebird.org/downloadMyData)
2. Download the CSV
3. In Claude, say: `Import my life list from /path/to/MyEBirdData.csv`

## Tools (21 total)

### Core eBird API (12)
| Tool | Description |
|------|-------------|
| `get_recent_observations` | Recent sightings in a region |
| `get_notable_observations` | Rare/unusual sightings |
| `get_nearby_observations` | Sightings near a location |
| `get_nearby_notable_observations` | Rarities near a location |
| `get_observations_for_species` | Sightings of a specific species |
| `get_nearest_observations_for_species` | Closest sighting of a species |
| `get_historic_observations` | Sightings on a specific date |
| `get_hotspots_in_region` | Birding hotspots in a region |
| `get_nearby_hotspots` | Hotspots near a location |
| `get_hotspot_info` | Details for a hotspot |
| `get_taxonomy` | Species taxonomy lookup |
| `get_species_list` | All species in a region |

### Life List (3)
| Tool | Description |
|------|-------------|
| `import_life_list` | Import your eBird CSV export |
| `check_life_list` | Check if a species is on your list |
| `get_life_list_stats` | Summary stats (total, by country, by year) |

### Intelligence (4)
| Tool | Description |
|------|-------------|
| `get_life_list_gaps_nearby` | Find potential lifers near you |
| `get_life_list_gaps_at_hotspot` | Lifers at a specific hotspot |
| `get_hotspots_along_route` | Birding stops along a driving route |
| `get_media_gaps` | Species with fewest recordings/photos |

### Utility (2)
| Tool | Description |
|------|-------------|
| `resolve_region_code` | Fuzzy match place names to eBird codes |
| `get_observation_frequency` | Estimate detection probability by date |

## External APIs

- **eBird API 2.0** — primary data source
- **OSRM** — free driving route calculation
- **Macaulay Library** — photo/audio/video counts
- **Xeno-canto** — audio recording counts

## License

MIT
