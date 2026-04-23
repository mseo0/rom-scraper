# Tasks

- [x] 1. CLI Argument Parsing
  - [x] 1.1 Add `parseArgs` function to `src/index.ts` that scans `process.argv` for `--search` flag and extracts the query value
  - [x] 1.2 Update `main()` in `src/index.ts` to call `parseArgs`, handle missing search value (print error, exit 1), and branch between normal and search mode
  - [x] 1.3 When `--search` is provided with whitespace-only value, treat as missing value and exit with error

- [x] 2. Search Module
  - [x] 2.1 Create `src/search.ts` with `searchGames(query: string, entries: GameEntry[]): GameEntry[]` function that trims the query, performs case-insensitive substring matching on `gameName`, and re-indexes results starting from 1

- [ ] 3. Formatter Additions
  - [-] 3.1 Add `formatSearchResults(entries: GameEntry[], query: string, errors: string[]): string` to `src/formatter.ts` that displays "Found X result(s) for '<query>':" header followed by the same table format, or "No games found matching '<query>'." when entries is empty
  - [-] 3.2 Include errors section in `formatSearchResults` output when errors exist

- [ ] 4. Unit Tests
  - [~] 4.1 Write unit tests for `parseArgs`: no flags → null, `--search zelda` → "zelda", `--search` at end → error, `--search "  "` → error
  - [~] 4.2 Write unit tests for `searchGames`: multi-word query matching, entries from multiple sources, case variations
  - [~] 4.3 Write unit tests for `formatSearchResults`: empty results message, non-empty results with header and table, errors appended

- [ ] 5. Property-Based Tests
  - [~] 5.1 [PBT] Property 1: CLI Argument Parsing Correctness — generate random non-empty query strings, construct argv with `--search <query>`, verify `parseArgs` returns the correct `searchQuery`; also verify absence of `--search` returns null
  - [~] 5.2 [PBT] Property 2: Case-Insensitive Substring Filter Correctness — generate random `GameEntry[]` arrays and random query strings, verify `searchGames` returns exactly those entries where `gameName.toLowerCase()` includes `query.trim().toLowerCase()`
  - [~] 5.3 [PBT] Property 3: Search Output Completeness — generate random non-empty `GameEntry[]` arrays and query strings, verify `formatSearchResults` output contains the entry count, the query, and each entry's `gameName`/`sourceName`/`downloadUrl`
  - [~] 5.4 [PBT] Property 4: Sequential Re-Indexing — generate random `GameEntry[]` arrays, run `searchGames`, verify the returned entries have `index` values forming the sequence 1, 2, ..., n
  - [~] 5.5 [PBT] Property 5: Whitespace Trimming Equivalence — generate random query strings, pad with random leading/trailing whitespace, verify `searchGames(padded, entries)` returns the same entries as `searchGames(trimmed, entries)`

- [ ] 6. Integration Test
  - [~] 6.1 Write integration test: mock all sources, run full pipeline with `--search` flag, verify filtered console output contains only matching entries
