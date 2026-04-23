# rom-scraper

A CLI tool that scrapes multiple Nintendo Switch ROM sources and displays `.nsp` file links in a formatted table.

## Sources

- FMHY
- RetrogradosGaming
- SwitchRom
- NSWTL
- SwitchRomsOrg
- Romenix

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

When results are found:

```
Found 3 result(s) for 'zelda':

┌───┬──────────────────────────────────┬────────────┬──────────────────────────────────┐
│ # │ Game Name                        │ Source     │ Download URL                     │
├───┼──────────────────────────────────┼────────────┼──────────────────────────────────┤
│ 1 │ Zelda TOTK                       │ FMHY       │ https://example.com/zelda.nsp    │
│ 2 │ Zelda Links Awakening            │ SwitchRom  │ https://example.com/zelda-la.nsp │
└───┴──────────────────────────────────┴────────────┴──────────────────────────────────┘
```

When no results match:

```
No games found matching 'nonexistent game'.
```

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
