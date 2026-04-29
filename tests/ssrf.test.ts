import { describe, expect, it } from 'vitest';
import { isPrivateIp } from '../src/services/FetchService.js';
import { matchesAnyDomain } from '../src/providers/BraveSearchProvider.js';

describe('isPrivateIp', () => {
  it('flags IPv4 loopback, RFC 1918, link-local, CGNAT and multicast', () => {
    for (const ip of [
      '127.0.0.1',
      '127.255.255.255',
      '10.0.0.1',
      '172.16.0.1',
      '172.31.255.254',
      '192.168.1.1',
      '169.254.1.1',
      '100.64.0.1',
      '224.0.0.1',
      '0.0.0.0'
    ]) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
  });

  it('allows public IPv4', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '93.184.216.34']) {
      expect(isPrivateIp(ip), ip).toBe(false);
    }
  });

  it('flags IPv6 loopback, link-local, ULA, and v4-mapped private', () => {
    for (const ip of ['::1', '::', 'fe80::1', 'fc00::1', 'fd12:3456:789a::1', '::ffff:127.0.0.1']) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
  });

  it('allows public IPv6', () => {
    expect(isPrivateIp('2606:4700:4700::1111')).toBe(false);
    expect(isPrivateIp('::ffff:8.8.8.8')).toBe(false);
  });
});

describe('matchesAnyDomain', () => {
  it('matches host and subdomains exactly, not as a substring', () => {
    expect(matchesAnyDomain('https://example.com/x', ['example.com'])).toBe(true);
    expect(matchesAnyDomain('https://www.example.com/x', ['example.com'])).toBe(true);
    expect(matchesAnyDomain('https://notexample.com/x', ['example.com'])).toBe(false);
    expect(matchesAnyDomain('https://evil.com/example.com', ['example.com'])).toBe(false);
  });

  it('handles leading dots and case', () => {
    expect(matchesAnyDomain('https://API.Example.COM', ['.example.com'])).toBe(true);
  });

  it('returns false for invalid URLs', () => {
    expect(matchesAnyDomain('not a url', ['example.com'])).toBe(false);
  });
});
