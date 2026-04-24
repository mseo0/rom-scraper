# rom-scraper

A CLI tool that scrapes multiple Nintendo Switch ROM sources and displays download links in a formatted table. Supports single-pass scraping, deep-link two-step scraping, and multi-layer scraping (catalog → detail page → file host links).

## Sources

### Single-pass sources
- FMHY
- RetrogradosGaming
- NSWTL
- Romenix

### Multi-layer sources
These sources use a catalog → detail page → file host pipeline. The scraper follows links from the catalog to individual game pages, then extracts download links from recognized file hosting services.

- notUltraNX — `not.ultranx.ru/en`
- NXBrew — `nxbrew.net`
- SwitchGamesMall — `switchgamesmall.icu`
- Ziperto — `ziperto.com` (requires JS rendering)

### Recognized file hosts

Mega, Google Drive, MediaFire, 1fichier, MegaUp, SendCM, DooDrive, Uptobox, Gofile, Pixeldrain, KrakenFiles, Buzzheavier

Link shorteners and ad gates (bit.ly, adf.ly, ouo.io, linkvertise.com, etc.) are automatically filtered out.

## Setup

```bash
git clone [this repo]
cd rom-scraper
npm install
npm run build
```

## Install globally

```bash
npm run build
npm install -g .
```

## Usage

Scrape all sources and display every result:

```bash
rom-scraper
```

Search for a specific game:

```bash
rom-scraper --search "zelda"
```

### Search examples

```bash
# Case-insensitive, matches partial names
rom-scraper --search "mario"
rom-scraper --search "metroid"

# Multi-word queries work as a single substring match
rom-scraper --search "fire emblem"
```

### Output

Games from multi-layer sources show all available file host links:

```
Found 3 result(s) for 'zelda':

┌───┬──────────────────────────┬──────────┬──────────────────────────────────────────────┐
│ # │ Game Name                │ Source   │ Download URL                                 │
├───┼──────────────────────────┼──────────┼──────────────────────────────────────────────┤
│ 1 │ Zelda: TOTK              │ Ziperto  │ [Mega] https://mega.nz/file/abc123           │
│   │                          │          │ [1fichier] https://1fichier.com/?xyz          │
│   │                          │          │ [MediaFire] https://mediafire.com/file/abc    │
├───┼──────────────────────────┼──────────┼──────────────────────────────────────────────┤
│ 2 │ Zelda: Links Awakening   │ FMHY     │ [Direct Download] https://example.com/z.nsp  │
└───┴──────────────────────────┴──────────┴──────────────────────────────────────────────┘
```

When no results match:

```
No games found matching 'nonexistent game'.
```

## Architecture

The scraper uses three pipeline types depending on the source:

1. **Single-pass** — Fetches one page, extracts download links directly
2. **Deep-link** — Fetches a listing page, follows links to detail pages, extracts downloads
3. **Multi-layer** — Fetches a catalog page, follows links to detail pages, extracts file host links through a domain registry, filters out intermediaries

Each source has a dedicated parser in `src/parsers/` that handles its specific HTML structure. The file host registry (`src/fileHosts.ts`) recognizes download destinations by domain rather than file extension.

## Development

```bash
# Run tests
npm test

# Build
npm run build
```

## Requirements

- Node.js 18+
- npm
