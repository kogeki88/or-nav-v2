// The feedback screenshots on the phone (ticket #23): the capture lands in the cache, which Android may
// clear, so the outbox moves it into the app's own folder as feedback/<report id>.jpg while the
// report waits, reads it for the upload, and removes it once the report is sent.
// Expo SDK 58 file system API (File, Directory, Paths).
import { Directory, File, Paths } from 'expo-file-system';

function folder(): Directory {
  const dir = new Directory(Paths.document, 'feedback');
  dir.create({ idempotent: true, intermediates: true });
  return dir;
}

export async function keepPicture(from: string, reportId: string): Promise<string> {
  const file = new File(from);
  await file.move(new File(folder(), `${reportId}.jpg`), { overwrite: true });
  return file.uri;
}

export async function readPicture(uri: string): Promise<ArrayBuffer | null> {
  const file = new File(uri);
  return file.exists ? file.arrayBuffer() : null;
}

export async function dropPicture(uri: string): Promise<void> {
  const file = new File(uri);
  if (file.exists) file.delete();
}
