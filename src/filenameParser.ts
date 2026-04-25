import { normalizeGameName } from './merger';

export interface ParsedRomFilename {
  /** Raw extracted game name (before normalization) */
  rawName: string;
  /** Normalized game name (via normalizeGameName) for matching */
  normalizedName: string;
  /** Extracted version string, or null if no version found */
  version: string | null;
}

/**
 * Known ROM file extensions (lowercase, with leading dot).
 */
const ROM_EXTENSIONS = ['.nsp', '.nsz', '.xci'];

/**
 * Region tags that appear in parentheses within ROM filenames.
 * Matched case-insensitively.
 */
const REGION_TAGS = [
  'USA', 'EUR', 'Europe', 'Japan', 'JPN', 'JP', 'World', 'US', 'EU',
  'Asia', 'Korea', 'KOR', 'China', 'CHN', 'Taiwan', 'TWN',
];

/**
 * Regex for version patterns in brackets: [v1.2.3] or [v1.0]
 */
const BRACKET_VERSION_RE = /\[v(\d+(?:\.\d+)*)\]/i;

/**
 * Regex for version patterns in parentheses: (v1.2.3) or (v1.0)
 */
const PAREN_VERSION_RE = /\(v(\d+(?:\.\d+)*)\)/i;

/**
 * Regex for bare version patterns: v1.2 or v1.2.3
 * Uses word boundary to avoid matching inside other words.
 */
const BARE_VERSION_RE = /\bv(\d+(?:\.\d+)+)\b/i;

/**
 * Regex for Nintendo Switch title IDs: hex strings starting with 0100, typically 16 chars.
 * These appear in brackets like [0100F2C0115B6000].
 */
const TITLE_ID_RE = /\[0100[0-9A-Fa-f]{12}\]/;

/**
 * Parse a ROM filename into its components.
 *
 * Handles patterns like:
 *   "Game Name [v1.2.3] [0100ABC012345000].nsp"
 *   "Game Name (v1.0.0) (USA).xci"
 *   "Game Name v2.0.nsz"
 *   "Game Name [0100ABC012345000].nsp" (no version)
 */
export function parseRomFilename(filename: string): ParsedRomFilename {
  let name = filename;

  // 1. Strip file extension
  const lowerName = name.toLowerCase();
  for (const ext of ROM_EXTENSIONS) {
    if (lowerName.endsWith(ext)) {
      name = name.slice(0, name.length - ext.length);
      break;
    }
  }

  // 2. Extract version (try bracket, then paren, then bare — first match wins)
  let version: string | null = null;

  const bracketMatch = name.match(BRACKET_VERSION_RE);
  if (bracketMatch) {
    version = bracketMatch[1];
    name = name.replace(BRACKET_VERSION_RE, '');
  } else {
    const parenMatch = name.match(PAREN_VERSION_RE);
    if (parenMatch) {
      version = parenMatch[1];
      name = name.replace(PAREN_VERSION_RE, '');
    } else {
      const bareMatch = name.match(BARE_VERSION_RE);
      if (bareMatch) {
        version = bareMatch[1];
        name = name.replace(BARE_VERSION_RE, '');
      }
    }
  }

  // 3. Strip title IDs like [0100F2C0115B6000]
  name = name.replace(TITLE_ID_RE, '');

  // 4. Strip region tags in parentheses: (USA), (EUR), etc.
  const regionPattern = new RegExp(
    `\\((${REGION_TAGS.join('|')})\\)`,
    'gi',
  );
  name = name.replace(regionPattern, '');

  // 5. Strip any remaining bracket [...] or paren (...) metadata
  name = name.replace(/\[[^\]]*\]/g, '');
  name = name.replace(/\([^)]*\)/g, '');

  // 6. Clean up whitespace
  name = name.replace(/\s+/g, ' ').trim();

  const rawName = name;
  const normalizedName = normalizeGameName(rawName);

  return { rawName, normalizedName, version };
}

/**
 * Compare two version strings. Returns:
 *   -1 if a < b
 *    0 if a === b
 *    1 if a > b
 *
 * Versions are compared numerically segment by segment (e.g., "1.2.3" vs "1.10.0").
 * Missing trailing segments are treated as 0 (e.g., "1.2" equals "1.2.0").
 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const aParts = a.split('.').map(Number);
  const bParts = b.split('.').map(Number);
  const maxLen = Math.max(aParts.length, bParts.length);

  for (let i = 0; i < maxLen; i++) {
    const aVal = aParts[i] ?? 0;
    const bVal = bParts[i] ?? 0;
    if (aVal < bVal) return -1;
    if (aVal > bVal) return 1;
  }

  return 0;
}
