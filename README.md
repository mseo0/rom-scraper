# rom-scraper

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=nodedotjs&logoColor=white)
![npm](https://img.shields.io/badge/npm-CB3837?logo=npm&logoColor=white)
![License](https://img.shields.io/badge/License-GPL--3.0-blue)
![Platform](https://img.shields.io/badge/Platform-Linux%20%7C%20macOS%20%7C%20Windows-lightgrey)
![CLI](https://img.shields.io/badge/Interface-CLI-black?logo=windowsterminal&logoColor=white)
![Nintendo Switch](https://img.shields.io/badge/Nintendo%20Switch-E60012?logo=nintendoswitch&logoColor=white)

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

Or use the `--search` (or `-s`) flag:

```bash
rom-scraper --search zelda
rom-scraper -s zelda
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

  1. The Legend of Zelda: Echoes of Wisdom (notUltraNX) [4 links]
  2. Super Mario Odyssey (notUltraNX) [3 links]
  3. Metroid Dread (notUltraNX, NXBrew) [5 links]

  Select game #:
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

Search results show a compact game list. Pick a game by number to see its download links:

```
Found 3 result(s) for 'zelda':

  1. The Legend of Zelda: Echoes of Wisdom (notUltraNX) [4 links]
  2. The Legend of Zelda: Tears of the Kingdom (notUltraNX, NXBrew) [5 links]
  3. The Legend of Zelda: Skyward Sword HD (notUltraNX) [3 links]

  Select game #: 2
```

After selecting a game, its download links are shown with numbered entries:

```
The Legend of Zelda: Tears of the Kingdom

  notUltraNX
    [1] Base Game (downloader.disk.yandex.ru)
    [2] Update (downloader.disk.yandex.ru)
    [3] Full Pack (downloader.disk.yandex.ru)
  NXBrew
    [4] 1fichier (1fichier.com)

  Copy link #: 1
  Copied [1]: https://downloader.disk.yandex.ru/disk/...
```

You can copy multiple links in a row. Type `q` or press Enter to go back to the game list.

Download labels:
- **Base Game** — the main game file
- **Update** — latest game update/patch
- **Full Pack** — base game + update bundled together
- **DLC** — downloadable content

### Flags

| Flag | Description |
|------|-------------|
| `<query>` | Search for a game by name |
| `--search <query>`, `-s <query>` | Search for a game (explicit flag) |
| `--new` | Show recently added games |
| `--ping` | Check if sources are reachable |
| `--no-validate`, `-nv` | Skip dead link validation (one-off) |
| `-nv off` | Disable link validation persistently |
| `-nv on` | Re-enable link validation persistently |
| `-h`, `--help` | Show help message |

Flags are mutually exclusive. You can't combine `--new`, `--ping`, or a search query.

### Link Validation

By default, rom-scraper checks that download links are alive before showing them. This adds a few seconds per search. You can control this:

```bash
rom-scraper -nv off     # turn validation off (saved to ~/.rom-scraper.json)
rom-scraper -nv on      # turn it back on

rom-scraper zelda       # uses your saved setting
rom-scraper zelda -nv   # one-off skip, doesn't change saved setting
```

## Sources

| Source | URL | Notes |
|--------|-----|-------|
| notUltraNX | `https://not.ultranx.ru/en` | Clean HTML, direct API downloads, free account required |
| NXBrew | `https://nxbrew.net/` | Large catalog, static HTML, file host links (1fichier, Mega, etc.) |

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
├── clipboard.ts      # Cross-platform clipboard copy
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

This tool is for educational and personal use only. The developers are not responsible for how you use it. Respect the terms of service of the sites being scraped.

### Source Reliability

- **Links can go dead at any time.** File hosts regularly remove content due to DMCA takedowns, inactivity, or abuse reports. A link that works today may not work tomorrow.
- **No guarantees on file integrity.** This tool scrapes links from third-party sites. It does not verify that downloaded files are safe, complete, or free of malware. Always scan downloads with antivirus software.
- **Source sites change without notice.** ROM catalog sites frequently change their HTML structure, domains, or access requirements. This can break scraping at any time. Run `rom-scraper --ping` to check source availability.
- **Results vary by source.** Different sources may list different games, use different naming conventions, or have different link quality. Cross-source merging is best-effort based on game name similarity.
- **File host availability varies by region.** Some file hosts may be blocked or throttled in certain countries. If a download link doesn't work, try a different source or host.
- **This tool does not host or distribute any files.** It only aggregates publicly available links from third-party websites.
