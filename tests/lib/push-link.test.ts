import { describe, expect, it } from 'vitest';
import {
  NYMAG_PUSH_DOMAINS,
  PUSH_LINK_SCHEME,
  buildPushLink,
  buildPushLinkForUri,
  isNymagPushHost,
} from '@/lib/push-link';

describe('isNymagPushHost', () => {
  it('matches the apex of every configured NYMag domain', () => {
    for (const domain of NYMAG_PUSH_DOMAINS) {
      expect(isNymagPushHost(domain)).toBe(true);
    }
  });

  it('matches production www subdomains', () => {
    expect(isNymagPushHost('www.vulture.com')).toBe(true);
    expect(isNymagPushHost('www.thecut.com')).toBe(true);
    expect(isNymagPushHost('www.grubstreet.com')).toBe(true);
    expect(isNymagPushHost('www.curbed.com')).toBe(true);
    expect(isNymagPushHost('nymag.com')).toBe(true);
  });

  it('matches non-prod + vertical subdomains (stg/qa/clay/feature-branch)', () => {
    expect(isNymagPushHost('stg.vulture.com')).toBe(true);
    expect(isNymagPushHost('qa.thecut.com')).toBe(true);
    expect(isNymagPushHost('clay.nymag.com')).toBe(true);
    expect(isNymagPushHost('my-branch.dev.nymag.com')).toBe(true);
  });

  it('covers Intelligencer + The Strategist via nymag.com', () => {
    // Both verticals are served under nymag.com, so the host check passes
    // for the brand even though there's no dedicated domain entry.
    expect(isNymagPushHost('nymag.com')).toBe(true);
  });

  it('is case-insensitive and tolerates whitespace + an explicit port', () => {
    expect(isNymagPushHost('WWW.VULTURE.COM')).toBe(true);
    expect(isNymagPushHost('  www.vulture.com  ')).toBe(true);
    expect(isNymagPushHost('stg.nymag.com:3000')).toBe(true);
  });

  it('rejects non-NYMag and look-alike hosts', () => {
    expect(isNymagPushHost('example.com')).toBe(false);
    expect(isNymagPushHost('notvulture.com')).toBe(false);
    // `evilnymag.com` ends with `nymag.com` but is not a subdomain of it.
    expect(isNymagPushHost('evilnymag.com')).toBe(false);
    // Suffix-spoof: NYMag domain appears as a label, not the registrable root.
    expect(isNymagPushHost('vulture.com.evil.test')).toBe(false);
  });

  it('rejects empty / nullish input', () => {
    expect(isNymagPushHost('')).toBe(false);
    expect(isNymagPushHost('   ')).toBe(false);
    expect(isNymagPushHost(null)).toBe(false);
    expect(isNymagPushHost(undefined)).toBe(false);
  });
});

describe('buildPushLink', () => {
  it('builds a nymag:// deep link with an .html suffix', () => {
    expect(buildPushLink('www.vulture.com/_pages/cm4u9ht9400000ih1477u0hyj')).toBe(
      'nymag://www.vulture.com/_pages/cm4u9ht9400000ih1477u0hyj.html'
    );
  });

  it('strips @published (apps resolve the published article from the bare path)', () => {
    expect(buildPushLink('www.vulture.com/_pages/abc@published')).toBe(
      'nymag://www.vulture.com/_pages/abc.html'
    );
  });

  it('strips an existing protocol so the scheme is exactly nymag://', () => {
    expect(buildPushLink('https://www.thecut.com/_pages/abc')).toBe(
      'nymag://www.thecut.com/_pages/abc.html'
    );
    expect(buildPushLink('http://nymag.com/_pages/xyz')).toBe('nymag://nymag.com/_pages/xyz.html');
  });

  it('uses the documented scheme constant', () => {
    expect(buildPushLink('nymag.com/_pages/x').startsWith(PUSH_LINK_SCHEME)).toBe(true);
  });
});

describe('buildPushLinkForUri', () => {
  it('returns the deep link when the page URI host is a NYMag domain', () => {
    expect(buildPushLinkForUri('www.vulture.com/_pages/cm4u9ht9400000ih1477u0hyj@published')).toBe(
      'nymag://www.vulture.com/_pages/cm4u9ht9400000ih1477u0hyj.html'
    );
  });

  it('returns null for a non-NYMag host', () => {
    expect(buildPushLinkForUri('www.example.com/_pages/abc')).toBeNull();
  });

  it('returns null for nullish input', () => {
    expect(buildPushLinkForUri(null)).toBeNull();
    expect(buildPushLinkForUri(undefined)).toBeNull();
    expect(buildPushLinkForUri('')).toBeNull();
  });
});
