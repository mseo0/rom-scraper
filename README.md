# Switper

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
switper --ping
```

If after this the issue persists then open an issue.

## Install

### From Source

```bash
git clone <this repo>
cd switper
npm install
npm run build
```

### Install Globally

```bash
npm run build
npm install -g .
```

After this you can run `switper` from anywhere.

### Uninstall

```bash
npm uninstall -g switper
```

## Account Setup

notUltraNX requires a free account. Register at [not.ultranx.ru/en/register](https://not.ultranx.ru/en/register), then run `switper`. It will prompt for your credentials on first use and save them to `~/.switper.json` (chmod 600).

## Usage

```
switper [options] [query]
```

### Search

Search by game name. Just type it:

```bash
switper zelda
switper fire emblem
switper "mario kart"
```

Or use the `--search` (or `-s`) flag:

```bash
switper --search zelda
switper -s zelda
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

### New Releases

Browse recently added games without a search query:

```bash
switper --new
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
switper --ping
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

After selecting a game, its download links are shown with numbered entries. Links marked with ⬇ download directly in the CLI. Links marked with 🌐 open in the browser.

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
  ✓ nsz → Decompressed → /Users/you/roms/game.nsp
```

Direct downloads include a progress bar with speed and ETA. After downloading:
- `.zip` files are automatically extracted, then the zip is deleted
- `.nsz` files are automatically decompressed to `.nsp` using [nsz](https://github.com/nicoboss/nsz), then the nsz is deleted
- Hosts that can't be downloaded directly (Mega, 1fichier) open in the browser instead

Type `q` or press Enter to go back to the game list.

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
| `-d`, `--download-dir <path>` | Set download directory (saved to config) |
| `-h`, `--help` | Show help message |

Flags are mutually exclusive. You can't combine `--new`, `--ping`, or a search query.

### Link Validation

By default, Switper checks that download links are alive before showing them. This adds a few seconds per search. You can control this:

```bash
switper -nv off     # turn validation off (saved to ~/.switper.json)
switper -nv on      # turn it back on

switper zelda       # uses your saved setting
switper zelda -nv   # one-off skip, doesn't change saved setting
```

### Download Directory

By default, files download to the current working directory. Set a persistent download folder:

```bash
switper -d ~/roms           # saved to ~/.switper.json
switper zelda               # downloads go to ~/roms
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
├── index.ts              # CLI entry point, argument parsing
├── orchestrator.ts       # Scraping pipeline coordinator
├── fetcher.ts            # HTTP fetching (static + browser)
├── parser.ts             # Parser registry
├── search.ts             # Game name filtering
├── formatter.ts          # Console output formatting
├── downloader.ts         # HTTP file downloader with progress
├── downloadProgress.ts   # Download progress bar rendering
├── nsz.ts                # NSZ → NSP auto-decompression
├── zip.ts                # ZIP auto-extraction
├── clipboard.ts          # Cross-platform clipboard copy
├── progress.ts           # Animated spinner
├── ping.ts               # Source health checks
├── fileHosts.ts          # File host domain registry + classification
├── auth.ts               # Authentication + config management
├── sources.ts            # Source configuration
├── types.ts              # TypeScript interfaces
└── parsers/
    ├── notUltraNX.ts     # notUltraNX catalog + detail parser
    └── nxBrew.ts         # NXBrew catalog + detail parser
```

## Recommended Tools

- [nsz](https://github.com/nicoboss/nsz) — Highly recommended. If installed, Switper automatically decompresses `.nsz` files to `.nsp` after downloading. Install it and make sure `nsz` is on your PATH.

## Disclaimer

This tool is for educational and personal use only. The developers are not responsible for how you use it. Respect the terms of service of the sites being scraped.

### Source Reliability

- **Links can go dead at any time.** File hosts regularly remove content due to DMCA takedowns, inactivity, or abuse reports. A link that works today may not work tomorrow.
- **No guarantees on file integrity.** This tool scrapes links from third-party sites. It does not verify that downloaded files are safe, complete, or free of malware. Always scan downloads with antivirus software.
- **Source sites change without notice.** ROM catalog sites frequently change their HTML structure, domains, or access requirements. This can break scraping at any time. Run `switper --ping` to check source availability.
- **Results vary by source.** Different sources may list different games, use different naming conventions, or have different link quality. Cross-source merging is best-effort based on game name similarity.
- **File host availability varies by region.** Some file hosts may be blocked or throttled in certain countries. If a download link doesn't work, try a different source or host.
- **This tool does not host or distribute any files.** It only aggregates publicly available links from third-party websites.
