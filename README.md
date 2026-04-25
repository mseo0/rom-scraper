# Switper

**Search, download, and update Nintendo Switch ROMs from your terminal.**

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=nodedotjs&logoColor=white)
![npm](https://img.shields.io/badge/npm-CB3837?logo=npm&logoColor=white)
![License](https://img.shields.io/badge/License-GPL--3.0-blue)
![Platform](https://img.shields.io/badge/Platform-Linux%20%7C%20macOS%20%7C%20Windows-lightgrey)
![CLI](https://img.shields.io/badge/Interface-CLI-black?logo=windowsterminal&logoColor=white)
![Nintendo Switch](https://img.shields.io/badge/Nintendo%20Switch-E60012?logo=nintendoswitch&logoColor=white)
![Tests](https://img.shields.io/badge/Tests-411%20passed-brightgreen)

One command to search multiple ROM sources, merge results, download directly with a progress bar, and check your library for updates. No browser needed.

<!-- Replace this comment with a GIF demo: record with https://github.com/charmbracelet/vhs or https://asciinema.org -->
<!-- Example: ![demo](assets/demo.gif) -->

## Quick Start

```bash
git clone <this repo> && cd switper
npm install && npm run build && npm install -g .
switper zelda         # first run auto-launches setup
```

That's it. On first run, Switper automatically walks you through setup before searching.

## Why Switper?

**Before Switper:**
1. Open browser, navigate to ROM site
2. Search for game, click through pages
3. Find download link, click through file host redirects
4. Wait for countdown timers, solve CAPTCHAs
5. Download finishes — it's an NSZ, now find a decompressor
6. Repeat for updates and DLC
7. Manually check if your ROMs have newer versions available

**With Switper:**
```bash
switper zelda              # search → pick → download → done
switper --update            # scan your library, see what's outdated
```

## What It Does

- **Search across multiple sources:** queries notUltraNX and NXBrew simultaneously, merges results by game name
- **Download directly from the terminal:** progress bar with speed and ETA, no browser needed
- **Post-download options:** after downloading, Switper asks if you want to extract ZIPs and decompress NSZ → NSP (requires [nsz](https://github.com/nicoboss/nsz) for decompression, optional)
- **Check for updates:** scans your local ROM library, parses filenames, compares against scraped data, tells you what's outdated
- **Dead link filtering:** validates download links before showing them so you don't waste time on broken links
- **Fuzzy name matching:** normalizes messy ROM filenames (`Game Name [v1.2.3] [0100ABC012345000] (USA).nsp`) to match against catalog listings
- **Ignore list:** suppress update notifications for games you don't care about

## Reliability

- 411 automated tests including 24 property-based test suites
- Handles 10+ ROM filename formats: `[vX.Y.Z]`, `(vX.Y.Z)`, bare `vX.Y`, title IDs, region tags, DLC tags, and more
- Cross-source merging with normalized game name matching
- Version comparison handles edge cases: missing segments, zero-padding, single-segment versions

### Is This Safe?

Switper is fully open source. It makes no network requests other than scraping the configured ROM catalog sites and downloading files you explicitly select. No telemetry, no phoning home. Credentials are stored locally in `~/.switper.json` with restricted permissions (chmod 600) and are only sent to the sites you authenticate with. No post-install scripts, no obfuscated code, no bundled binaries.

## Table of Contents

- [Install](#install)
- [Account Setup](#account-setup)
- [Usage](#usage)
- [Update Checker](#update-checker)
- [Sources](#sources)
- [Flags](#flags)
- [Dependencies](#dependencies)
- [Development](#development)
- [Legal](#legal)
- [Disclaimer](#disclaimer)

## Install

```bash
git clone <this repo>
cd switper
npm install
npm run build
npm install -g .    # optional: makes `switper` available globally
```

To uninstall: `npm uninstall -g switper`

## Account Setup

notUltraNX requires a free account. Register at [not.ultranx.ru/en/register](https://not.ultranx.ru/en/register) (use an ad blocker like uBlock Origin when visiting). This is a one-time step — after that, Switper communicates with the API directly and you never need to visit the site again. Run `switper` and it will prompt for your credentials, saving them locally to `~/.switper.json` (chmod 600).

## Usage

### Search

```bash
switper zelda                # search by game name
switper fire emblem          # multi-word search
switper -s "mario kart"      # explicit search flag
```

### Interactive Mode

Run without arguments for a search prompt that loops:

```
$ switper

  switper
  Nintendo Switch ROM search tool

  Search Game: zelda
```

Type `exit`, `quit`, `q`, or press Enter on empty to exit.

### Downloading

Search results show a compact game list. Pick a game by number, then pick a download link:

```
Found 3 result(s) for 'zelda':

  1. The Legend of Zelda: Echoes of Wisdom (notUltraNX) [4 links]
  2. The Legend of Zelda: Tears of the Kingdom (notUltraNX, NXBrew) [5 links]
  3. The Legend of Zelda: Skyward Sword HD (notUltraNX) [3 links]

  Select game #: 2
```

```
The Legend of Zelda: Tears of the Kingdom

  notUltraNX
    [1] ⬇ Base Game (downloader.disk.yandex.ru)
    [2] ⬇ Update (downloader.disk.yandex.ru)
    [3] ⬇ Full Pack (downloader.disk.yandex.ru)
  NXBrew
    [4] 🌐 1fichier (1fichier.com)

  Download link #: 1
  Downloading [1]...
  ⬇ [████████████████████] 100% 4.3 GB / 4.3 GB  15.2 MB/s  ETA 0s
  ✓ Downloaded 4.3 GB → /Users/you/roms/game.nsz
  Extract zip? (Y/n): y
  Decompress NSZ → NSP? (Y/n): y
  ✓ nsz → Decompressed → /Users/you/roms/game.nsp
```

- ⬇ = downloads directly in the CLI
- 🌐 = opens in the browser (Mega, 1fichier, etc.)
- After downloading, Switper asks if you want to extract `.zip` files and decompress `.nsz` → `.nsp`
- NSZ decompression requires [nsz](https://github.com/nicoboss/nsz) on PATH (optional — most emulators play `.nsz` directly)

Download labels: **Base Game** | **Update** | **Full Pack** | **DLC**

### New Releases

```bash
switper --new
```

### Ping Sources

```bash
switper --ping
```

```
  ✓ notUltraNX — UP (200) [142ms]

  Ping complete: 1/1 sources reachable
```

## Update Checker

Scan your local ROM library and see which games have newer versions available:

```bash
switper init               # first time: set your game directory
switper --update                # compare local ROMs against scraped data
switper --update --refresh     # force a fresh scrape
```

Switper parses your ROM filenames (handles messy names with version tags, title IDs, region codes), normalizes them, and matches against cached scraped data. Results show what you have vs. what's available:

```
3 update(s) available:

  • The Legend of Zelda: Tears of the Kingdom  1.0.0 → 1.2.1  (NXBrew)
  • Super Mario Odyssey  1.0.0 → 1.3.0  (notUltraNX)
  • Metroid Dread  unknown → 2.1.0  (NXBrew)
```

Scraped data is cached locally for 24 hours to keep checks fast.

### Ignore List

```bash
switper --ignore "zelda"     # stop notifications for a specific game
switper --ignore all         # suppress all update notifications
switper --ignore list        # see what's ignored
switper --ignore reset       # clear the ignore list
```

## Sources

| Source | URL | Notes |
|--------|-----|-------|
| notUltraNX | `https://not.ultranx.ru/en` | Direct API downloads, free account required |
| NXBrew | `https://nxbrew.net/` | Large catalog, file host links (1fichier, Mega, etc.) |

## Flags

| Flag | Description |
|------|-------------|
| `<query>` | Search for a game by name |
| `-s <query>`, `--search <query>` | Search (explicit flag) |
| `--new` | Browse recently added games |
| `--ping` | Check if sources are reachable |
| `init` | Run interactive setup wizard |
| `--update` | Check your library for available updates |
| `--refresh` | Force fresh scrape (with `--update`) |
| `--ignore <name>` | Add a game to the ignore list |
| `--ignore all` | Suppress all update notifications |
| `--ignore reset` | Clear the ignore list |
| `--ignore list` | Show ignored games |
| `-nv`, `--no-validate` | Skip dead link validation (one-off) |
| `-nv off` | Disable link validation persistently |
| `-nv on` | Re-enable link validation |
| `-d <path>`, `--download-dir <path>` | Set download directory |
| `-h`, `--help` | Show help message |

### Link Validation

By default, Switper checks that download links are alive before showing them. Control this:

```bash
switper -nv off     # turn validation off (saved to config)
switper -nv on      # turn it back on
switper zelda -nv   # one-off skip
```

### Download Directory

Set your game directory to your emulator's ROM folder so downloaded games are immediately available to play. This directory is also used for update checks.

```bash
switper -d ~/roms           # saved to ~/.switper.json
```

## Dependencies

- [Node.js](https://nodejs.org/) 18+
- npm
- A free [notUltraNX](https://not.ultranx.ru/en/register) account

### Runtime

- [axios](https://github.com/axios/axios) — HTTP client
- [cheerio](https://github.com/cheeriojs/cheerio) — HTML parsing
- [cli-table3](https://github.com/cli-table/cli-table3) — Table formatting
- [stealthwright](https://github.com/nicedoc/stealthwright) — Browser-based fetching for JS-rendered sites

### Recommended

- [nsz](https://github.com/nicoboss/nsz) — Optional. If installed, Switper can decompress `.nsz` → `.nsp` after downloading. Most emulators play `.nsz` directly so this isn't required.

## Development

```bash
npm test          # run tests (411 tests, 52 files)
npm run build     # compile TypeScript
```

### Project Structure

```
src/
├── index.ts              # CLI entry point, argument parsing
├── orchestrator.ts       # Scraping pipeline coordinator
├── fetcher.ts            # HTTP fetching (static + browser)
├── parser.ts             # Parser registry
├── search.ts             # Game name filtering
├── formatter.ts          # Console output formatting
├── filenameParser.ts     # ROM filename → game name + version
├── updateCache.ts        # Scraped data cache with TTL
├── updateChecker.ts      # Library scan + update detection
├── init.ts               # Interactive setup wizard
├── downloader.ts         # HTTP file downloader with progress
├── downloadProgress.ts   # Download progress bar rendering
├── merger.ts             # Cross-source game name merging
├── nsz.ts                # NSZ → NSP decompression (optional)
├── zip.ts                # ZIP extraction
├── clipboard.ts          # Cross-platform clipboard copy
├── progress.ts           # Animated spinner
├── ping.ts               # Source health checks
├── fileHosts.ts          # File host domain registry
├── auth.ts               # Authentication + config management
├── sources.ts            # Source configuration
├── types.ts              # TypeScript interfaces
└── parsers/
    ├── notUltraNX.ts     # notUltraNX parser
    └── nxBrew.ts         # NXBrew parser
```

## Fixing Errors

```bash
git pull && npm run build   # update to latest
switper --ping              # check if sources are up
```

If the issue persists, open an issue.

## Legal

This software is provided under the [GPL-3.0 license](LICENSE). By using Switper, you acknowledge and agree to the following:

- **Switper is a search and aggregation tool.** It does not host, store, distribute, or reproduce any copyrighted content. It functions similarly to a search engine by indexing publicly accessible links from third-party websites.
- **You are solely responsible for how you use this tool.** Downloading copyrighted material without authorization may violate the laws of your country. The developers do not condone or encourage piracy.
- **Switper does not circumvent any copy protection or DRM.** It only interacts with publicly available web pages and download links that require no circumvention to access.
- **No warranty.** This software is provided "as is," without warranty of any kind, express or implied. The developers are not liable for any damages or legal consequences arising from its use.
- **Respect the terms of service** of the sites being accessed. Your use of third-party sites through this tool is governed by their respective terms.
- **DMCA / Takedown requests** should be directed at the source sites that host the content, not at this project. Switper does not control or have the ability to remove any linked content.

If you are a rights holder and believe this tool facilitates infringement, please open an issue and we will address your concerns promptly.

## Disclaimer

This tool is for educational and personal use only. The developers are not responsible for how you use it. Respect the terms of service of the sites being scraped.

### Source Reliability

- **Links can go dead at any time.** File hosts regularly remove content due to DMCA takedowns, inactivity, or abuse reports.
- **No guarantees on file integrity.** Always scan downloads with antivirus software.
- **Source sites change without notice.** Run `switper --ping` to check availability.
- **Results vary by source.** Cross-source merging is best-effort based on game name similarity.
- **File host availability varies by region.** If a download link doesn't work, try a different source or host.
- **This tool does not host or distribute any files.** It only aggregates publicly available links.
