// OR-Nav in-app updater: checks GitHub Releases, downloads or-nav.apk, opens Android's installer.
import * as Application from 'expo-application';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';

import { APK_NAME, RemoteRelease, compareVersions, latestRelease } from './releaseSource';

export type { RemoteRelease };

// FLAG_GRANT_READ_URI_PERMISSION (1) | FLAG_ACTIVITY_NEW_TASK (268435456)
const INSTALL_FLAGS = 268435457;

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

export async function checkForUpdate(): Promise<UpdateCheck> {
  const remote = await latestRelease();
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
