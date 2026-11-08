// OR-Nav in-app updater: checks GitHub Releases, downloads or-nav.apk, opens Android's installer.
import * as Application from 'expo-application';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';

export const RELEASES_URL = 'https://api.github.com/repos/kogeki88/or-nav-v2/releases/latest';
const APK_NAME = 'or-nav.apk';
// FLAG_GRANT_READ_URI_PERMISSION (1) | FLAG_ACTIVITY_NEW_TASK (268435456)
const INSTALL_FLAGS = 268435457;

export type RemoteRelease = {
  tag: string;
  version: string;
  apkUrl: string;
};

export type UpdateCheck = {
  installed: string;
  remote: RemoteRelease;
  updateAvailable: boolean;
};

export function installedVersion(): string {
  return Application.nativeApplicationVersion ?? '0.0.0';
}

export function installedBuild(): string {
  return Application.nativeBuildVersion ?? '?';
}

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

export async function fetchLatestRelease(): Promise<RemoteRelease> {
  let res: Response;
  try {
    res = await fetch(RELEASES_URL, { headers: { Accept: 'application/vnd.github+json' } });
  } catch {
    throw new Error('No network. Updates need an internet connection.');
  }
  if (res.status === 404) throw new Error('No release published yet.');
  if (res.status === 403) throw new Error('GitHub rate limit reached. Try again in an hour.');
  if (!res.ok) throw new Error(`GitHub answered ${res.status}.`);

  const body = await res.json();
  const tag: string = body.tag_name ?? '';
  const asset = (body.assets ?? []).find((a: { name: string }) => a.name === APK_NAME);
  if (!tag || !asset) throw new Error(`Latest release has no ${APK_NAME}.`);
  return { tag, version: tag.replace(/^v/i, ''), apkUrl: asset.browser_download_url };
}

export async function checkForUpdate(): Promise<UpdateCheck> {
  const remote = await fetchLatestRelease();
  const installed = installedVersion();
  return { installed, remote, updateAvailable: compareVersions(remote.version, installed) > 0 };
}

/** Downloads the APK with progress (0..1), then hands it to Android's package installer. */
export async function downloadAndInstall(
  release: RemoteRelease,
  onProgress: (fraction: number) => void,
): Promise<void> {
  const target = `${FileSystem.cacheDirectory}${APK_NAME}`;
  await FileSystem.deleteAsync(target, { idempotent: true });

  const download = FileSystem.createDownloadResumable(release.apkUrl, target, {}, (p) => {
    if (p.totalBytesExpectedToWrite > 0) {
      onProgress(p.totalBytesWritten / p.totalBytesExpectedToWrite);
    }
  });
  const result = await download.downloadAsync();
  if (!result || result.status !== 200) {
    throw new Error(`Download failed${result ? ` (${result.status})` : ''}.`);
  }
  onProgress(1);

  const contentUri = await FileSystem.getContentUriAsync(result.uri);
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: contentUri,
    flags: INSTALL_FLAGS,
    type: 'application/vnd.android.package-archive',
  });
}
