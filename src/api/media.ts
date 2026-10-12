// Photos and voice recordings in the private `media` storage bucket.
//
// Files are stored as '<family_id>/<random id>.<ext>'. Nothing is public: to show a
// file, the app asks for a signed URL that works for a few minutes. Because those
// URLs expire, the tablet keeps its own copy of each file on the device
// (cacheMedia), so it can keep showing photos and playing voice messages offline.
import { randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';

import { supabase } from './client';
import { throwIfError, unwrap } from './errors';

const BUCKET = 'media';
const SIGNED_URL_SECONDS = 5 * 60;

// File extension -> content type. Must stay within the bucket's allowed types
// (see the migration).
const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  m4a: 'audio/mp4',
  mp4: 'audio/mp4',
  aac: 'audio/aac',
  mp3: 'audio/mpeg',
  webm: 'audio/webm',
};

/** 'photo.JPG' -> 'jpg'. */
export function extensionOf(fileNameOrUri: string): string {
  const match = /\.([A-Za-z0-9]+)(?:[?#].*)?$/.exec(fileNameOrUri);
  return match ? match[1].toLowerCase() : '';
}

/** Uploads raw bytes into the family's folder. Returns the storage path. */
export async function uploadBytes(
  familyId: string,
  bytes: ArrayBuffer | Uint8Array,
  extension: string,
): Promise<string> {
  const contentType = CONTENT_TYPES[extension];
  if (!contentType) {
    throw new Error(`Unsupported file type: .${extension}`);
  }
  const path = `${familyId}/${randomUUID()}.${extension}`;
  throwIfError(await supabase().storage.from(BUCKET).upload(path, bytes, { contentType }));
  return path;
}

/** Uploads a file from the phone (e.g. from the camera or voice recorder). */
export async function uploadLocalFile(familyId: string, localUri: string): Promise<string> {
  const file = new File(localUri);
  return uploadBytes(familyId, await file.bytes(), extensionOf(file.name));
}

export async function deleteMedia(path: string): Promise<void> {
  throwIfError(await supabase().storage.from(BUCKET).remove([path]));
}

/** A link to the file that stops working after a few minutes. */
export async function getSignedUrl(path: string): Promise<string> {
  const data = unwrap(
    await supabase().storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS),
  );
  return data.signedUrl;
}

// Kept in the documents folder rather than the cache folder, because Android may
// empty the cache folder when storage is low, and the tablet needs these offline.
function cacheDirectory(): Directory {
  const directory = new Directory(Paths.document, 'media');
  if (!directory.exists) {
    directory.create({ intermediates: true });
  }
  return directory;
}

function cachedFile(path: string): File {
  // '<family_id>/<id>.jpg' -> '<family_id>_<id>.jpg' (one flat folder).
  return new File(cacheDirectory(), path.replace(/\//g, '_'));
}

/** The local copy of a file if it has been downloaded already, otherwise null. Works offline. */
export function cachedMediaUri(path: string): string | null {
  const file = cachedFile(path);
  return file.exists ? file.uri : null;
}

/** Downloads a file to the device (once) and returns its local URI. */
export async function cacheMedia(path: string): Promise<string> {
  const destination = cachedFile(path);
  if (destination.exists) {
    return destination.uri;
  }
  // Download to a temporary file first and move it into place only when complete,
  // so a dropped connection can't leave a half-downloaded photo in the cache.
  const temporary = new File(Paths.cache, `${randomUUID()}.download`);
  await File.downloadFileAsync(await getSignedUrl(path), temporary);
  await temporary.move(destination);
  return destination.uri;
}

/** Deletes downloaded files that are no longer needed, e.g. for hidden or old messages. */
export function pruneMediaCache(keepPaths: string[]): void {
  const keep = new Set(keepPaths.map((path) => cachedFile(path).name));
  for (const entry of cacheDirectory().list()) {
    if (entry instanceof File && !keep.has(entry.name)) {
      entry.delete();
    }
  }
}
