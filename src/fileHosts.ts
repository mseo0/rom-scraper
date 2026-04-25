/** Classification of how a host's links should be handled */
export type HostType = 'direct' | 'browser-only';

/** Recognized file hosting domains mapped to display names and host types */
const FILE_HOST_DOMAINS: Map<string, { hostName: string; hostType: HostType }> = new Map([
  ['mega.nz', { hostName: 'Mega', hostType: 'browser-only' }],
  ['mega.io', { hostName: 'Mega', hostType: 'browser-only' }],
  ['drive.google.com', { hostName: 'Google Drive', hostType: 'direct' }],
  ['mediafire.com', { hostName: 'MediaFire', hostType: 'direct' }],
  ['1fichier.com', { hostName: '1fichier', hostType: 'browser-only' }],
  ['megaup.net', { hostName: 'MegaUp', hostType: 'direct' }],
  ['sendcm.com', { hostName: 'SendCM', hostType: 'direct' }],
  ['doodrive.com', { hostName: 'DooDrive', hostType: 'direct' }],
  ['uptobox.com', { hostName: 'Uptobox', hostType: 'direct' }],
  ['gofile.io', { hostName: 'Gofile', hostType: 'direct' }],
  ['pixeldrain.com', { hostName: 'Pixeldrain', hostType: 'direct' }],
  ['krakenfiles.com', { hostName: 'KrakenFiles', hostType: 'direct' }],
  ['buzzheavier.com', { hostName: 'Buzzheavier', hostType: 'direct' }],
  ['api.ultranx.ru', { hostName: 'notUltraNX', hostType: 'direct' }],
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
  hostType: HostType;
}

/** Check if a DownloadLink is directly downloadable */
export function isDirectDownload(link: DownloadLink): boolean {
  return link.hostType === 'direct';
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

/** Known non-download path on file host domains (abuse pages, terms, etc.) */
const REJECTED_PATHS: string[] = [
  '/abuse', '/terms', '/about', '/contact', '/privacy', '/dmca',
  '/tos', '/faq', '/help', '/login', '/register', '/signup',
];

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
 * - Non-download paths on file host domains (/abuse, /terms, etc.)
 */
export function matchFileHost(url: string): DownloadLink | null {
  const parsed = tryParseUrl(url);
  if (!parsed) return null;

  const hostname = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname.toLowerCase();

  // Reject known non-download paths (abuse pages, terms, etc.)
  for (const rejected of REJECTED_PATHS) {
    if (pathname === rejected || pathname === rejected + '/') {
      return null;
    }
  }

  for (const [domain, hostInfo] of FILE_HOST_DOMAINS) {
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
      }

      return { url, hostName: hostInfo.hostName, hostType: hostInfo.hostType };
    }
  }

  // Check for known ROM file extensions
  for (const ext of ROM_EXTENSIONS) {
    if (pathname.endsWith(ext)) {
      return { url, hostName: 'Direct Download', hostType: 'direct' };
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
export function registerFileHost(
  domain: string,
  hostName: string,
  hostType: HostType = 'direct',
): void {
  FILE_HOST_DOMAINS.set(domain.toLowerCase(), { hostName, hostType });
}

/**
 * Add a new intermediary domain at runtime.
 */
export function registerIntermediary(domain: string): void {
  INTERMEDIARY_DOMAINS.push(domain.toLowerCase());
}
