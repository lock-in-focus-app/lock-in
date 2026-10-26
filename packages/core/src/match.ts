/**
 * Checks a URL against a browser match pattern (`<scheme>://<host>/<path>`).
 * Follows the WebExtension rules: `*.` in the host also matches the bare domain,
 * and `*` as the scheme means http or https.
 */
export function matchesPattern(pattern: string, url: string | URL): boolean {
  const parsed = parsePattern(pattern);
  if (!parsed) return false;

  let target: URL;
  try {
    target = typeof url === 'string' ? new URL(url) : url;
  } catch {
    return false;
  }

  const scheme = target.protocol.slice(0, -1);
  const schemeOk = parsed.scheme === '*' ? scheme === 'http' || scheme === 'https' : scheme === parsed.scheme;
  if (!schemeOk) return false;

  if (!hostMatches(parsed.host, target.hostname)) return false;

  return globToRegExp(parsed.path).test(target.pathname + target.search);
}

/**
 * Converts a match pattern into an equivalent regular expression source, for APIs that
 * take a regex instead of a pattern (like declarativeNetRequest's `regexFilter`). Only
 * uses syntax that RE2 supports. Returns null for malformed patterns.
 */
export function matchPatternToRegex(pattern: string): string | null {
  const parsed = parsePattern(pattern);
  if (!parsed) return null;

  const scheme = parsed.scheme === '*' ? 'https?' : parsed.scheme;
  let host: string;
  if (parsed.host === '*') host = '[^/:]+';
  else if (parsed.host.startsWith('*.')) host = `([^/:]+\\.)?${escapeRegExp(parsed.host.slice(2))}`;
  else host = escapeRegExp(parsed.host);

  return `^${scheme}://${host}(:[0-9]+)?${globToRegExpSource(parsed.path)}$`;
}

function parsePattern(pattern: string): { scheme: string; host: string; path: string } | null {
  const match = /^(\*|https?):\/\/([^/]+)(\/.*)$/.exec(pattern);
  if (!match) return null;
  const [, scheme, host, path] = match;
  return { scheme: scheme!, host: host!, path: path! };
}

function hostMatches(patternHost: string, hostname: string): boolean {
  if (patternHost === '*') return true;
  if (patternHost.startsWith('*.')) {
    const base = patternHost.slice(2);
    return hostname === base || hostname.endsWith(`.${base}`);
  }
  return hostname === patternHost;
}

function globToRegExp(glob: string): RegExp {
  return new RegExp(`^${globToRegExpSource(glob)}$`);
}

function globToRegExpSource(glob: string): string {
  return glob.split('*').map(escapeRegExp).join('.*');
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
