import { describe, expect, it } from 'vitest';
import { matchesPattern } from './match';

describe('matchesPattern', () => {
  it('matches subdomains and the bare domain for *. hosts', () => {
    expect(matchesPattern('*://*.reddit.com/*', 'https://www.reddit.com/r/writing')).toBe(true);
    expect(matchesPattern('*://*.reddit.com/*', 'https://old.reddit.com/')).toBe(true);
    expect(matchesPattern('*://*.reddit.com/*', 'https://reddit.com/')).toBe(true);
  });

  it('does not match lookalike domains', () => {
    expect(matchesPattern('*://*.reddit.com/*', 'https://notreddit.com/')).toBe(false);
    expect(matchesPattern('*://*.reddit.com/*', 'https://reddit.com.evil.example/')).toBe(false);
  });

  it('limits * schemes to http and https', () => {
    expect(matchesPattern('*://*.reddit.com/*', 'http://reddit.com/')).toBe(true);
    expect(matchesPattern('*://*.reddit.com/*', 'ftp://reddit.com/')).toBe(false);
    expect(matchesPattern('https://*.reddit.com/*', 'http://reddit.com/')).toBe(false);
  });

  it('matches paths as globs', () => {
    expect(matchesPattern('*://*.reddit.com/r/*', 'https://www.reddit.com/r/writing')).toBe(true);
    expect(matchesPattern('*://*.reddit.com/r/*', 'https://www.reddit.com/user/me')).toBe(false);
  });

  it('rejects malformed patterns and URLs', () => {
    expect(matchesPattern('reddit.com', 'https://reddit.com/')).toBe(false);
    expect(matchesPattern('*://*.reddit.com/*', 'not a url')).toBe(false);
  });
});
