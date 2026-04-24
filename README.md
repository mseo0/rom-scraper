# rom-scraper

A CLI tool that scrapes Nintendo Switch ROM sources and displays download links with file host names. Uses a multi-layer scraping pipeline: catalog page → detail page → file host link extraction.

## Sources

| Source | URL | JS Required |
|--------|-----|-------------|
| notUltraNX | not.ultranx.ru | No |
| NXBrew | nxbrew.net | No |
| SwitchGamesMall | smallgames.ch | No |
| Ziperto | ziperto.com | Yes (Cloudflare) |

### Recognized file hosts

Mega, Google Drive, MediaFire, 1fichier, MegaUp, SendCM, DooDrive, Uptobox, Gofile, Pixeldrain, KrakenFiles, Buzzheavier, notUltraNX API

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

Search for a specific game across all sources:

```bash
rom-scraper --search "zelda"
```

When `--search` is used, each source's native search is queried directly instead of scraping the front page. This means you can find any game the site has, not just what's on the first page.

### Search examples

```bash
rom-scraper --search "mario"
rom-scraper --search "metroid"
rom-scraper --search "fire emblem"
```

### Output

```
Found 1 result(s) for 'metroid':

┌───┬──────────────────────────┬────────────┬──────────────────────────────────────────────────────┐
│ # │ Game Name                │ Source     │ Download URL                                         │
├───┼──────────────────────────┼────────────┼──────────────────────────────────────────────────────┤
│ 1 │ Metroid Prime™ 4: Beyond │ notUltraNX │ [notUltraNX] https://api.ultranx.ru/games/download/…│
│   │                          │            │ [notUltraNX] https://api.ultranx.ru/games/download/…│
│   │                          │            │ [notUltraNX] https://api.ultranx.ru/games/download/…│
└───┴──────────────────────────┴────────────┴──────────────────────────────────────────────────────┘
```

## Development

```bash
npm test
npm run build
```

## Requirements

- Node.js 18+
- npm
- Google Chrome (for JS-rendered sources)
