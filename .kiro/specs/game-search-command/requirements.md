# Requirements Document

## Introduction

A search command for the NSP web scraper console application that allows users to filter scraped game results by name. Instead of displaying all discovered Game_Entry results, the user can provide a search query to find specific games across all Target_Sources. The search runs after the scraping pipeline completes and filters the collected results using case-insensitive substring matching.

## Glossary

- **Scraper**: The console application that fetches, parses, and displays `.nsp` file information from multiple target sources
- **Search_Command**: A CLI mode that accepts a search query string and filters scraped results to display only matching Game_Entry records
- **Search_Query**: The text string provided by the user to match against game names
- **Game_Entry**: A single result consisting of a game name, its associated direct download URL, and the Source it was discovered on
- **Console_Output**: The formatted text-based display rendered in the user's terminal
- **Target_Sources**: The collection of web pages the Scraper fetches content from
- **Site_Parser**: A source-specific parsing module that extracts Game_Entry records from the HTML content of a single Target_Source

## Requirements

### Requirement 1: Accept a Search Query via CLI Argument

**User Story:** As a user, I want to pass a game name as a command-line argument, so that I can search for a specific game without modifying code.

#### Acceptance Criteria

1. WHEN the user launches the Scraper with a `--search` flag followed by a Search_Query, THE Scraper SHALL enter search mode and use the provided Search_Query to filter results
2. WHEN the user launches the Scraper without the `--search` flag, THE Scraper SHALL display all results as it does today
3. IF the user provides the `--search` flag without a Search_Query value, THEN THE Scraper SHALL display an error message stating that a search term is required and exit with a non-zero exit code

### Requirement 2: Filter Game Results by Search Query

**User Story:** As a user, I want the scraper to filter results by game name, so that I only see games matching my search term.

#### Acceptance Criteria

1. WHEN the Scraper is in search mode, THE Scraper SHALL compare the Search_Query against each Game_Entry game name using case-insensitive substring matching
2. WHEN a Game_Entry game name contains the Search_Query as a substring (case-insensitive), THE Scraper SHALL include that Game_Entry in the filtered results
3. WHEN a Game_Entry game name does not contain the Search_Query as a substring, THE Scraper SHALL exclude that Game_Entry from the filtered results
4. THE Scraper SHALL perform filtering after all Target_Sources have been scraped and parsed

### Requirement 3: Display Filtered Search Results

**User Story:** As a user, I want search results displayed in the same table format as the full results, so that the output is consistent and readable.

#### Acceptance Criteria

1. WHEN the Scraper is in search mode and matching Game_Entry records exist, THE Console_Output SHALL display the filtered results using the same table format as the standard output, including columns for index number, game name, source site, and download URL
2. WHEN the Scraper is in search mode and matching Game_Entry records exist, THE Console_Output SHALL display the count of matching results and the Search_Query used above the table
3. IF no Game_Entry records match the Search_Query, THEN THE Console_Output SHALL display a message stating that no games matched the Search_Query
4. THE Console_Output SHALL re-index the filtered results starting from 1, so that the displayed index numbers are sequential

### Requirement 4: Search Query Handles Edge Cases

**User Story:** As a user, I want the search to handle various input formats gracefully, so that I get useful results regardless of how I type the game name.

#### Acceptance Criteria

1. WHEN the Search_Query contains leading or trailing whitespace, THE Scraper SHALL trim the whitespace before performing the search
2. WHEN the Search_Query contains multiple words, THE Scraper SHALL treat the entire string as a single substring to match against game names
3. WHEN the Search_Query matches multiple Game_Entry records from different sources, THE Scraper SHALL include all matching records in the filtered results

### Requirement 5: Reliable NSP Link Extraction Across All Target Sources

**User Story:** As a user, I want the scraper to correctly extract .nsp file links from every target source, so that I get complete results even when links are hidden or not directly visible on the page.

#### Acceptance Criteria

1. THE Scraper SHALL extract .nsp links from each Target_Source using a source-specific Site_Parser tailored to that site's HTML structure
2. WHEN a Target_Source renders .nsp links via client-side JavaScript, THE Scraper SHALL use a browser-based fetcher to obtain the fully rendered page content before parsing
3. WHEN a Target_Source embeds .nsp links inside encoded or obfuscated attributes (such as base64-encoded hrefs or data attributes), THE Site_Parser SHALL decode the attribute values and extract the underlying .nsp URLs
4. WHEN a Target_Source places .nsp links behind redirect URLs or wrapper links, THE Site_Parser SHALL resolve or extract the final .nsp download URL from the redirect path
5. THE Site_Parser for each Target_Source SHALL scan all anchor elements and relevant HTML attributes in the fetched content, not only top-level visible links
6. IF a Site_Parser fails to extract any Game_Entry records from a Target_Source that previously returned results, THEN THE Scraper SHALL log a warning message identifying the Target_Source by name
7. FOR ALL Target_Sources in the configured source list, THE Scraper SHALL attempt extraction and report per-source result counts so the user can verify completeness
