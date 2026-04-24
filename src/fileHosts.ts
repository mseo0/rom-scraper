/** Recognized file hosting domains mapped to display names */
const FILE_HOST_DOMAINS: Map<string, string> = new Map([
  ['mega.nz', 'Mega'],
  ['mega.io', 'Mega'],
  ['drive.google.com', 'Google Drive'],
  ['mediafire.com', 'MediaFire'],
  ['1fichier.com', '1fichier'],
  ['megaup.net', 'MegaUp'],
  ['sendcm.com', 'SendCM'],
  ['doodrive.com', 'DooDrive'],
  ['uptobox.com', 'Uptobox'],
  ['gofile.io', 'Gofile'],
  ['pixeldrain.com', 'Pixeldrain'],
  ['krakenfiles.com', 'KrakenFiles'],
  ['buzzheavier.com', 'Buzzheavier'],
  ['api.ultranx.ru', 'notUltraNX'],
]);

/** Known intermediary / ad gate domains */
const INTERMEDIARY_DOMAINS: string[] = [
  'bit.ly', 'adf.ly', 'ouo.io', 'linkvertise.com',
  'shrinkme.io', 'exe.io', 'bc.vc', 'shorturl.at',
  'tinyurl.com', 'cutt.ly', 'shorte.st',
];

/** Known ROM file extensions that count as valid download links */
const ROM_EXTENSIONS = ['.nsp', '.xci', '.nsz'];

export interface DownloadLink {
  url: string;
  hostName: string;
}

/**
 * Parse a URL string into a URL object, returning null on failure.
 */
function tryParseUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/**
 * Check if a URL's domain matches a registered file host.
 * Supports subdomain matching: hostname `nz.mega.nz` matches registered domain `mega.nz`
 * because the hostname ends with `.mega.nz`.
 *
 * Also matches URLs ending in known ROM file extensions (.nsp, .xci, .nsz)
 * with a generic "Direct Download" host name.
 *
 * Rejects known false-positive patterns:
 * - 1fichier.com affiliate-only links (only ?af=... with no file ID)
 */
export function matchFileHost(url: string): DownloadLink | null {
  const parsed = tryParseUrl(url);
  if (!parsed) return null;

  const hostname = parsed.hostname.toLowerCase();

  for (const [domain, hostName] of FILE_HOST_DOMAINS) {
    if (hostname === domain || hostname.endsWith('.' + domain)) {
      // Reject 1fichier affiliate-only links: URLs where the only query
      // parameter is "af" (affiliate ID) with no file identifier.
      // Real 1fichier download links have a random file ID as the first
      // parameter, e.g., ?qkrl9796m94wqb1e0ow7 or ?qkrl9796m94wqb1e0ow7&af=327151
      if (domain === '1fichier.com') {
        const params = parsed.searchParams;
        const keys = Array.from(params.keys());
        // If the only key is "af", this is an affiliate link, not a download
        if (keys.length === 1 && keys[0] === 'af') {
          return null;
        }
        // If there are no query params at all, it's just the homepage
        if (keys.length === 0 && !parsed.search) {
          return null;
        }
      }

      return { url, hostName };
    }
  }

  // Check for known ROM file extensions
  const pathname = parsed.pathname.toLowerCase();
  for (const ext of ROM_EXTENSIONS) {
    if (pathname.endsWith(ext)) {
      return { url, hostName: 'Direct Download' };
    }
  }

  return null;
}

/**
 * Check if a URL's domain matches a known intermediary (link shortener / ad gate).
 * Supports subdomain matching the same way as matchFileHost.
 */
export function isIntermediary(url: string): boolean {
  const parsed = tryParseUrl(url);
  if (!parsed) return false;

  const hostname = parsed.hostname.toLowerCase();

  for (const domain of INTERMEDIARY_DOMAINS) {
    if (hostname === domain || hostname.endsWith('.' + domain)) {
      return true;
    }
  }

  return false;
}

/**
 * Filter a list of candidate URLs: return only those matching
 * the file host registry (or ROM file extensions), excluding
 * intermediaries and unrecognized URLs.
 */
export function filterDownloadLinks(urls: string[]): DownloadLink[] {
  const results: DownloadLink[] = [];

  for (const url of urls) {
    if (isIntermediary(url)) continue;

    const link = matchFileHost(url);
    if (link) {
      results.push(link);
    }
  }

  return results;
}

/**
 * Add a new file host domain at runtime (for extensibility).
 */
export function registerFileHost(domain: string, hostName: string): void {
  FILE_HOST_DOMAINS.set(domain.toLowerCase(), hostName);
}

/**
 * Add a new intermediary domain at runtime.
 */
export function registerIntermediary(domain: string): void {
  INTERMEDIARY_DOMAINS.push(domain.toLowerCase());
}
