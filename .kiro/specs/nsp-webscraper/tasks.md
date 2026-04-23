# Tasks

- [x] 1. Project Setup
  - [x] 1.1 Initialize Node.js project with TypeScript, install dependencies (axios, puppeteer, cheerio, cli-table3, fast-check, vitest, nock)
  - [x] 1.2 Configure tsconfig.json and package.json scripts (build, start, test)
  - [x] 1.3 Create project directory structure: src/, src/parsers/, src/types.ts, tests/

- [x] 2. Core Types and Configuration
  - [x] 2.1 Define Source, GameEntry, FetchResult, and ParseResult interfaces in src/types.ts
  - [x] 2.2 Create src/sources.ts with the TARGET_SOURCES configuration array

- [x] 3. Fetcher Module
  - [x] 3.1 Implement fetchStatic() using axios with 30-second timeout in src/fetcher.ts
  - [x] 3.2 Implement fetchWithBrowser() using Puppeteer with 30-second timeout in src/fetcher.ts
  - [x] 3.3 Implement fetchSource() that routes to static or browser fetch based on source.requiresJs
  - [x] 3.4 Implement error handling: return FetchResult with error message for HTTP errors, timeouts, and connection failures

- [x] 4. Parser Module — Core Functions
  - [x] 4.1 Implement isNspLink() function in src/parser.ts for case-insensitive .nsp URL detection
  - [x] 4.2 Implement extractGameName() function to extract game name from link text or URL filename
  - [x] 4.3 Implement parseSource() dispatcher that routes HTML to the correct source-specific parser

- [x] 5. Source-Specific Parsers
  - [x] 5.1 Implement parseFmhy() in src/parsers/fmhy.ts for fmhy.net HTML structure
  - [x] 5.2 Implement parseRetrogrados() in src/parsers/retrogrados.ts for retrogradosgaming.com HTML structure
  - [x] 5.3 Implement parseSwitchrom() in src/parsers/switchrom.ts for switchrom.net HTML structure
  - [x] 5.4 Implement parseNswtl() in src/parsers/nswtl.ts for nswtl.info HTML structure
  - [x] 5.5 Implement parseSwitchRomsOrg() in src/parsers/switchRomsOrg.ts for switch-roms.org HTML structure
  - [x] 5.6 Implement parseRomenix() in src/parsers/romenix.ts for romenix.net HTML structure

- [x] 6. Formatter Module
  - [x] 6.1 Implement truncate() function in src/formatter.ts (50 chars for names, 80 chars for URLs, append "...")
  - [x] 6.2 Implement formatResults() to build console table with header, divider, aligned columns using cli-table3
  - [x] 6.3 Implement summary line showing total count and per-source breakdown

- [x] 7. Progress Reporter
  - [x] 7.1 Implement reportFetching(), reportParsing(), and reportComplete() in src/progress.ts

- [x] 8. Orchestrator and Entry Point
  - [x] 8.1 Implement scrapeAll() in src/orchestrator.ts — iterate sources, fetch, parse, collect results and errors
  - [x] 8.2 Implement CLI entry point in src/index.ts — call orchestrator, format results, display output
  - [x] 8.3 Handle edge cases: no results from any source, all sources failed

- [x] 9. Unit Tests
  - [x] 9.1 Write unit tests for isNspLink() with concrete URL examples
  - [x] 9.2 Write unit tests for extractGameName() with known link text and URL patterns
  - [x] 9.3 Write unit tests for truncate() with boundary values
  - [x] 9.4 Write unit tests for formatResults() with empty, single, and multi-source entries
  - [x] 9.5 Write unit tests for error message formatting

- [x] 10. Property-Based Tests
  - [x] 10.1 [PBT] Property 1: NSP link detection is case-insensitive — generate random .nsp URLs in various cases, verify isNspLink returns correct boolean
  - [x] 10.2 [PBT] Property 2: GameEntry completeness — generate random anchor elements with NSP links, verify all GameEntry fields are non-empty
  - [x] 10.3 [PBT] Property 3: Truncation correctness — generate random strings and max lengths, verify truncation behavior at boundary
  - [x] 10.4 [PBT] Property 4: Formatted output contains all entry data — generate random GameEntry arrays, verify output contains all names, sources, and URLs
  - [x] 10.5 [PBT] Property 5: Summary count consistency — generate random GameEntry arrays from multiple sources, verify total equals sum of per-source counts
  - [x] 10.6 [PBT] Property 6: Error message contains source URL and status code — generate random status codes and URLs, verify message content

- [x] 11. Integration Tests
  - [x] 11.1 Write integration test for full pipeline with mocked HTTP responses for all 6 sources
  - [x] 11.2 Write integration test for partial source failure (some sources fail, results still display)
  - [x] 11.3 Write integration test verifying Puppeteer is used for requiresJs sources
