# rom-scraper

A CLI tool for searching and downloading Nintendo Switch ROMs directly from [notUltraNX](https://not.ultranx.ru/en). Search by game name, get labeled download links in your terminal.

## Why notUltraNX

Most ROM sites are riddled with fake download buttons, ad gates, link shorteners, and malware-laced redirects. You click "Download" and end up on five different ad pages before landing on a sketchy `.exe` instead of your game.

notUltraNX is different:

- **Direct downloads** — files are served from their own API, not through third-party file hosts or ad-gated link shorteners
- **No intermediaries** — no bit.ly, adf.ly, ouo.io, linkvertise, or any other ad gate sitting between you and the file
- **No fake download buttons** — the site has a clean UI with real download links, no deceptive ads disguised as buttons
- **No malware risk from file hosts** — since files come from notUltraNX's own servers, you're not downloading from random file hosting services that bundle adware or worse
- **Account-gated** — requires a free account, which means the downloads are authenticated and tracked, reducing abuse and keeping the service clean

This tool automates the search and gives you direct download links without ever opening a browser or navigating through any site.

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

## Account setup

notUltraNX requires a free account. Register at [not.ultranx.ru/en/register](https://not.ultranx.ru/en/register), then run `rom-scraper`. It will prompt for your credentials on first use and save them to `~/.rom-scraper.json` (chmod 600).

## Usage

### Interactive mode

Just run it — you get a search prompt that loops:

```
$ rom-scraper

  🎮  rom-scraper
  Nintendo Switch ROM search tool

  Search Game: zelda
```

Type `exit`, `quit`, `q`, or press Enter to exit.

### Direct search

```bash
rom-scraper zelda
rom-scraper fire emblem
rom-scraper "mario kart"
```

### Output

Each result shows the game name, source, and labeled download packs with full URLs:

```
Found 5 result(s) for 'zelda':

1. The Legend of Zelda™: Echoes of Wisdom
   Source: notUltraNX
   Downloads:
  📦 Base Game: https://api.ultranx.ru/games/download/.../base
  📀 Full Pack: https://api.ultranx.ru/games/download/.../full

2. The Legend of Zelda™: Tears of the Kingdom
   Source: notUltraNX
   Downloads:
  📦 Base Game: https://api.ultranx.ru/games/download/.../base
  🔄 Update:    https://api.ultranx.ru/games/download/.../update
  📀 Full Pack: https://api.ultranx.ru/games/download/.../full
```

Download labels:
- 📦 **Base Game** — the main game file
- 🔄 **Update** — latest game update/patch
- 📀 **Full Pack** — base game + update bundled together
- 🧩 **DLC** — downloadable content

## Development

```bash
npm test
npm run build
```

## Requirements

- Node.js 18+
- npm
- A free notUltraNX account
