# Requirements Document

## Introduction

A console-based web scraper that targets multiple Nintendo Switch ROM source websites to discover `.nsp` file links. The scraper fetches and parses each source independently, extracts game names and their corresponding direct download URLs, then presents them in a well-formatted console table for easy browsing. If one source fails, the Scraper continues processing the remaining sources.

## Glossary

- **Scraper**: The console application that fetches, parses, and displays `.nsp` file information from multiple target sources
- **Target_Sources**: The collection of web pages the Scraper fetches content from, consisting of:
  1. `https://fmhy.net/gamingpiracyguide#nintendo-roms`
  2. `www.retrogradosgaming.com`
  3. `switchrom.net`
  4. `https://nswtl.info/`
  5. `https://switch-roms.org`
  6. `https://romenix.net/list?system=9&p=1`
- **Source**: A single web page from the Target_Sources list
- **NSP_Link**: A hyperlink found on a Source whose destination URL ends with the `.nsp` file extension or that represents a downloadable Switch ROM entry
- **Game_Entry**: A single result consisting of a game name, its associated direct download URL, and the Source it was discovered on
- **Console_Output**: The formatted text-based display rendered in the user's terminal

## Requirements

### Requirement 1: Fetch Content From Multiple Sources

**User Story:** As a user, I want the Scraper to fetch content from all Target_Sources, so that it can aggregate `.nsp` file links from multiple sites.

#### Acceptance Criteria

1. WHEN the user launches the Scraper, THE Scraper SHALL iterate over each Source in the Target_Sources list and send an HTTP GET request to each Source URL
2. WHEN a Source returns a successful response, THE Scraper SHALL pass that Source's HTML content to the parsing stage
3. IF a Source returns a non-success HTTP status code, THEN THE Scraper SHALL display an error message containing the Source URL and status code, and continue processing the remaining Sources
4. IF the network connection to a Source fails or times out, THEN THE Scraper SHALL display a descriptive connection error message identifying the Source, and continue processing the remaining Sources
5. THE Scraper SHALL complete each HTTP request within 30 seconds before treating that request as timed out
6. WHEN all Sources have been attempted, THE Scraper SHALL proceed to display results even if one or more Sources failed

### Requirement 2: Parse and Extract NSP Links From Each Source

**User Story:** As a user, I want the Scraper to find all `.nsp` file links across multiple sites with different page structures, so that I can see a comprehensive list of available games.

#### Acceptance Criteria

1. WHEN the HTML content from a Source is received, THE Scraper SHALL parse all hyperlinks within the relevant section of that Source's page
2. WHEN a hyperlink destination URL ends with `.nsp` (case-insensitive) or represents a downloadable Switch ROM entry, THE Scraper SHALL extract that link as an NSP_Link
3. WHEN an NSP_Link is found, THE Scraper SHALL extract the game name from the hyperlink text or the filename portion of the URL
4. THE Scraper SHALL store each discovered result as a Game_Entry containing the game name, the direct download URL, and the originating Source URL
5. THE Scraper SHALL use Source-specific parsing logic to handle the different HTML structures of each site in the Target_Sources list
6. IF no NSP_Links are found on a given Source, THEN THE Scraper SHALL display a message stating that no `.nsp` files were found on that Source and continue processing the remaining Sources
7. IF no NSP_Links are found across all Sources, THEN THE Scraper SHALL display a message stating that no `.nsp` files were found on any Source

### Requirement 3: Format and Display Results

**User Story:** As a user, I want the results displayed in a clean, readable console layout, so that I can easily browse game names and their download links.

#### Acceptance Criteria

1. THE Console_Output SHALL display Game_Entry results in a formatted table with columns for index number, game name, source site, and download URL
2. THE Console_Output SHALL include a header row that labels each column
3. THE Console_Output SHALL separate the header row from data rows with a horizontal divider line
4. THE Console_Output SHALL truncate game names longer than 50 characters and append an ellipsis indicator
5. THE Console_Output SHALL truncate download URLs longer than 80 characters and append an ellipsis indicator
6. WHEN results are displayed, THE Console_Output SHALL show the total count of discovered NSP_Links above the table, along with a per-Source breakdown
7. THE Console_Output SHALL align columns consistently across all rows for readability
8. THE Console_Output SHALL group or label results so the user can identify which Source each Game_Entry originated from

### Requirement 4: Handle Dynamic or JavaScript-Rendered Content

**User Story:** As a user, I want the Scraper to handle pages that load content dynamically, so that it can find links even if they are rendered via JavaScript.

#### Acceptance Criteria

1. WHEN a Source's content is loaded via JavaScript rendering, THE Scraper SHALL use a method capable of executing JavaScript to retrieve the fully rendered HTML
2. IF the rendered page content of a Source contains no hyperlinks in the relevant section, THEN THE Scraper SHALL report that the section could not be located or contained no links for that Source

### Requirement 5: User Feedback During Execution

**User Story:** As a user, I want to see progress indicators while the Scraper is working, so that I know the application has not frozen.

#### Acceptance Criteria

1. WHILE the Scraper is fetching the Target_Page, THE Scraper SHALL display a status message indicating that the page is being loaded
2. WHILE the Scraper is parsing HTML content, THE Scraper SHALL display a status message indicating that links are being extracted
3. WHEN the Scraper completes all processing, THE Scraper SHALL display a completion message before showing the results table
