# rom-scraper

A CLI to search and grab Nintendo Switch ROMs from the terminal. This tool scrapes [notUltraNX](https://not.ultranx.ru/en).

## Table of Contents

- [Fixing Errors](#fixing-errors)
- [Install](#install)
- [Account Setup](#account-setup)
- [Usage](#usage)
- [Sources](#sources)
- [Dependencies](#dependencies)
- [Development](#development)
- [Disclaimer](#disclaimer)

## Fixing Errors

If you encounter `No results found` or any breaking issue, make sure you are on the latest version:

```bash
git pull
npm run build
```

If the issue persists, check that the source site is reachable:

```bash
rom-scraper --ping
```

If after this the issue persists then open an issue.

## Install

### From Source

```bash
git clone <this repo>
cd rom-scraper
npm install
npm run build
```

### Install Globally

```bash
npm run build
npm install -g .
```

After this you can run `rom-scraper` from anywhere.

### Uninstall

```bash
npm uninstall -g rom-scraper
```

## Account Setup

notUltraNX requires a free account. Register at [not.ultranx.ru/en/register](https://not.ultranx.ru/en/register), then run `rom-scraper`. It will prompt for your credentials on first use and save them to `~/.rom-scraper.json` (chmod 600).

## Usage

```
rom-scraper [options] [query]
```

### Search

Search by game name. Just type it:

```bash
rom-scraper zelda
rom-scraper fire emblem
rom-scraper "mario kart"
```

Or use the `--search` flag:

```bash
rom-scraper --search zelda
```

### Interactive Mode

Run without arguments for a search prompt that loops:

```
$ rom-scraper

  rom-scraper
  Nintendo Switch ROM search tool

  Search Game: zelda
```

Type `exit`, `quit`, `q`, or press Enter on empty to exit.

### New Releases

Browse recently added games without a search query:

```bash
rom-scraper --new
```

```
New Releases — 3 game(s) found:

1. The Legend of Zelda: Echoes of Wisdom
   Source: notUltraNX
   Downloads:
  [base] Base Game: https://...
  [full] Full Pack: https://...

2. Super Mario Odyssey
   Source: notUltraNX
   Downloads:
  [base] Base Game: https://...
```

### Ping Sources

Check if sources are up before searching:

```bash
rom-scraper --ping
```

```
  ✓ notUltraNX — UP (200) [142ms]

  Ping complete: 1/1 sources reachable
```

### Output Format

Each result shows the game name, source, and labeled download packs:

```
Found 2 result(s) for 'zelda':

1. The Legend of Zelda: Echoes of Wisdom
   Source: notUltraNX
   Downloads:
  [base] Base Game: https://api.ultranx.ru/games/download/.../base
  [full] Full Pack: https://api.ultranx.ru/games/download/.../full

2. The Legend of Zelda: Tears of the Kingdom
   Source: notUltraNX
   Downloads:
  [base] Base Game: https://api.ultranx.ru/games/download/.../base
  [update] Update:  https://api.ultranx.ru/games/download/.../update
  [full] Full Pack: https://api.ultranx.ru/games/download/.../full
```

Download labels:
- **[base] Base Game** — the main game file
- **[update] Update** — latest game update/patch
- **[full] Full Pack** — base game + update bundled together
- **[dlc] DLC** — downloadable content

### Flags

| Flag | Description |
|------|-------------|
| `<query>` | Search for a game by name |
| `--search <query>` | Search for a game (explicit flag) |
| `--new` | Show recently added games |
| `--ping` | Check if sources are reachable |

Flags are mutually exclusive. You can't combine `--new`, `--ping`, or a search query.

## Sources

| Source | URL | Notes |
|--------|-----|-------|
| notUltraNX | `https://not.ultranx.ru/en` | Clean HTML, direct API downloads, free account required |

## Dependencies

- [Node.js](https://nodejs.org/) 18+
- npm
- A free [notUltraNX](https://not.ultranx.ru/en/register) account

### Runtime

- [axios](https://github.com/axios/axios) — HTTP client
- [cheerio](https://github.com/cheeriojs/cheerio) — HTML parsing
- [cli-table3](https://github.com/cli-table/cli-table3) — Table formatting
- [stealthwright](https://github.com/nicedoc/stealthwright) — Browser-based fetching for JS-rendered sites

## Development

```bash
npm test          # run tests
npm run build     # compile TypeScript
```

### Project Structure

```
src/
├── index.ts          # CLI entry point, argument parsing
├── orchestrator.ts   # Scraping pipeline coordinator
├── fetcher.ts        # HTTP fetching (static + browser)
├── parser.ts         # Parser registry
├── search.ts         # Game name filtering
├── formatter.ts      # Console output formatting
├── progress.ts       # Animated spinner
├── ping.ts           # Source health checks
├── fileHosts.ts      # File host domain registry
├── auth.ts           # notUltraNX authentication
├── sources.ts        # Source configuration
├── types.ts          # TypeScript interfaces
└── parsers/
    ├── notUltraNX.ts # notUltraNX catalog + detail parser
    └── nxBrew.ts     # NXBrew catalog + detail parser
```

## Disclaimer

This tool is for educational and personal use. The developers are not responsible for how you use it. Respect the terms of service of the sites being scraped.
