import { describe, expect, it } from '@jest/globals';
import { compareVersions, latestRelease } from './releaseSource';

const NO_WAIT: number[] = [];

function reply(status: number, body: unknown = {}, url = ''): Response {
  return { ok: status >= 200 && status < 300, status, url, json: async () => body } as unknown as Response;
}

describe('compareVersions', () => {
  it('treats 2.0.10 as newer than 2.0.9', () => {
    expect(compareVersions('2.0.10', '2.0.9')).toBeGreaterThan(0);
  });

  it('treats equal versions as equal', () => {
    expect(compareVersions('2.4.0', '2.4.0')).toBe(0);
  });
});

describe('latestRelease', () => {
  it('uses the GitHub API answer when it has the APK', async () => {
    const fetchFn = async () =>
      reply(200, {
        tag_name: 'v2.4.0',
        assets: [{ name: 'or-nav.apk', browser_download_url: 'https://example.test/or-nav.apk' }],
      });
    await expect(latestRelease(fetchFn, NO_WAIT)).resolves.toEqual({
      tag: 'v2.4.0',
      version: '2.4.0',
      apkUrl: 'https://example.test/or-nav.apk',
    });
  });

  it('falls back to the releases/latest redirect when the API is rate-limited', async () => {
    const fetchFn = async (url: string) =>
      url.includes('api.github.com')
        ? reply(403)
        : reply(200, {}, 'https://github.com/kogeki88/or-nav-v2/releases/tag/v2.3.1');
    const result = await latestRelease(fetchFn, NO_WAIT);
    expect(result.version).toBe('2.3.1');
    expect(result.apkUrl).toBe('https://github.com/kogeki88/or-nav-v2/releases/download/v2.3.1/or-nav.apk');
  });

  it('gives a plain-language error when GitHub cannot be reached', async () => {
    const fetchFn = async () => {
      throw new Error('offline');
    };
    await expect(latestRelease(fetchFn, NO_WAIT)).rejects.toThrow("Can't reach GitHub right now");
  });
});
