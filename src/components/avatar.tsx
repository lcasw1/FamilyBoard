// A person's profile photo in a circle, or, without a photo, a coloured circle
// with the first letter of their name. A familiar face is often easier for
// Grandma to recognise than a name.
//
// Usage:
//   <Avatar name="Lily" photoPath={member.photo_path} size={64} />
//   <Avatar name="Lily" localUri={pickedPhotoUri} size={160} />   // not uploaded yet
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { cacheMedia, cachedMediaUri } from '@/api/media';

import { colors } from './theme';

// Dark colours, so the white letter on top stays easy to read.
const COLORS = ['#0B5CAD', '#1B7F3B', '#8E3B00', '#6A1B9A', '#00695C', '#5D4037', '#AD1457'];

/** The letter shown without a photo: 'lily' -> 'L', '小丽' -> '小'. */
export function initialOf(name: string): string {
  // Array.from splits by character, so Chinese characters and emoji stay whole.
  return (Array.from(name.trim())[0] ?? '?').toUpperCase();
}

/** The same name always gets the same colour. */
export function colorFor(name: string): string {
  let sum = 0;
  for (const character of name) {
    sum += character.codePointAt(0) ?? 0;
  }
  return COLORS[sum % COLORS.length];
}

type AvatarProps = {
  name: string;
  /** The photo in the family's storage (members.photo_path). */
  photoPath?: string | null;
  /** A photo on this device that isn't uploaded yet; shown instead of photoPath. */
  localUri?: string | null;
  size: number;
};

export function Avatar({ name, photoPath, localUri, size }: AvatarProps) {
  const { t } = useTranslation();
  const storedUri = useStoredPhoto(photoPath ?? null);
  const uri = localUri ?? storedUri;
  const circle = { width: size, height: size, borderRadius: size / 2 };

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.photo, circle]}
        contentFit="cover"
        accessibilityLabel={t('avatar.label', { name })}
      />
    );
  }
  return (
    <View
      style={[styles.initialCircle, circle, { backgroundColor: colorFor(name) }]}
      accessibilityLabel={t('avatar.label', { name })}
    >
      <Text style={[styles.initial, { fontSize: size * 0.45 }]}>{initialOf(name)}</Text>
    </View>
  );
}

/**
 * The device's copy of a stored photo, downloading it the first time. Saved on the
 * device, so it also shows offline. Returns null until it's ready (or if there is
 * no photo, or the download fails), and the coloured letter shows meanwhile.
 */
function useStoredPhoto(path: string | null): string | null {
  // The photo downloaded by the effect below, remembered with the path it is for.
  const [downloaded, setDownloaded] = useState<{ path: string; uri: string } | null>(null);
  // Already on the device? Then use it straight away (a quick check, no network).
  const cached = path ? cachedMediaUri(path) : null;

  useEffect(() => {
    if (!path || cached) {
      return;
    }
    let cancelled = false;
    cacheMedia(path).then(
      (uri) => {
        if (!cancelled) setDownloaded({ path, uri });
      },
      () => {
        // Offline or a server problem: keep showing the letter.
      },
    );
    return () => {
      cancelled = true;
    };
  }, [path, cached]);

  if (!path) {
    return null;
  }
  return cached ?? (downloaded?.path === path ? downloaded.uri : null);
}

const styles = StyleSheet.create({
  photo: { backgroundColor: colors.surface },
  initialCircle: { alignItems: 'center', justifyContent: 'center' },
  initial: { color: colors.primaryText, fontWeight: '700' },
});
