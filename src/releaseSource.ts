// Finds the newest OR-Nav release on GitHub. Pure TypeScript (no Expo imports) so Node can test it.
// Order: GitHub API (with retries) -> releases/latest redirect (no API, no rate limit).

const REPO = 'kogeki88/or-nav-v2';
export const API_URL = `https://api.github.com/repos/${REPO}/releases/latest`;
export const LATEST_PAGE_URL = `https://github.com/${REPO}/releases/latest`;
export const APK_NAME = 'or-nav.apk';
const RETRY_DELAYS_MS = [1000, 3000];
const HEADERS = { 'User-Agent': 'OR-Nav-Updater' };

export type RemoteRelease = {
  tag: string;
  version: string;
  apkUrl: string;
};

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

/** Compares "2.0.10" with "2.0.9" by number. Returns >0 if a is newer. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(/[.-]/).map((n) => parseInt(n, 10) || 0);
  const pb = b.split(/[.-]/).map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Tries now, then after 1 s and 3 s, on network errors and server errors (5xx). */
export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  fetchFn: FetchFn = fetch,
  delays: number[] = RETRY_DELAYS_MS,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    if (attempt > 0) await sleep(delays[attempt - 1]);
    try {
      const res = await fetchFn(url, { ...init, headers: { ...HEADERS, ...(init.headers ?? {}) } });
      if (res.status < 500) return res;
      lastError = new Error(`GitHub answered ${res.status}`);
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}

function release(tag: string): RemoteRelease {
  return {
    tag,
    version: tag.replace(/^v/i, ''),
    apkUrl: `https://github.com/${REPO}/releases/download/${tag}/${APK_NAME}`,
  };
}

export async function fromApi(fetchFn: FetchFn = fetch, delays?: number[]): Promise<RemoteRelease> {
  const res = await fetchWithRetry(API_URL, { headers: { Accept: 'application/vnd.github+json' } }, fetchFn, delays);
  if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
  const body = await res.json();
  const tag: string = body.tag_name ?? '';
  const asset = (body.assets ?? []).find((a: { name: string }) => a.name === APK_NAME);
  if (!tag || !asset) throw new Error(`Latest release has no ${APK_NAME}`);
  return { ...release(tag), apkUrl: asset.browser_download_url };
}

/** github.com/.../releases/latest redirects to .../releases/tag/vX.Y.Z. */
export async function fromRedirect(fetchFn: FetchFn = fetch, delays?: number[]): Promise<RemoteRelease> {
  const res = await fetchWithRetry(LATEST_PAGE_URL, { method: 'HEAD' }, fetchFn, delays);
  const match = /\/releases\/tag\/([^/?#]+)$/.exec(res.url ?? '');
  if (!res.ok || !match) throw new Error('No release found');
  return release(decodeURIComponent(match[1]));
}

/** API first; if it fails for any reason, the redirect. Plain-language error if both fail. */
export async function latestRelease(fetchFn: FetchFn = fetch, delays?: number[]): Promise<RemoteRelease> {
  try {
    return await fromApi(fetchFn, delays);
  } catch {
    try {
      return await fromRedirect(fetchFn, delays);
    } catch {
      throw new Error("Can't reach GitHub right now. Check Wi-Fi or mobile data, then tap Check for Updates again.");
    }
  }
}
