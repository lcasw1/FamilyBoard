// One message, shown large on Grandma's tablet:
//   - photo: the photo, with its caption underneath
//   - note:  the text in big letters
//   - voice: "Lily sent you a voice message" and a big Play button
// Above it: who sent it and when. The only thing she ever has to press is Play,
// and nothing plays by itself.
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Image } from 'expo-image';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { cachedMediaUri } from '@/api/media';
import type { Message } from '@/api/messages';
import { formatDate } from '@/i18n/format-date';

import { colors, fontSizes, minTouchSize, spacing } from './theme';

type DisplayMessageProps = {
  message: Message;
  senderName: string | null;
  /** Called with true when a voice message starts playing, false when it stops. */
  onPlayingChange?: (playing: boolean) => void;
};

export function DisplayMessage({ message, senderName, onPlayingChange }: DisplayMessageProps) {
  const { t, i18n } = useTranslation();
  const name = senderName ?? t('display.someone');
  // created_at is stored in UTC; this shows it in the tablet's time zone,
  // e.g. "Tuesday 3:15 PM".
  const sentAt = formatDate(new Date(message.created_at), i18n.language, {
    weekday: 'long',
    hour: 'numeric',
    minute: '2-digit',
  });
  // The downloaded copy on the tablet (see useDisplayFeed), so it works offline.
  const fileUri = message.file_path ? cachedMediaUri(message.file_path) : null;

  return (
    <View style={styles.message}>
      <Text style={styles.from}>{t('display.from', { name, time: sentAt })}</Text>

      {message.type === 'photo' && fileUri && (
        <Image
          source={{ uri: fileUri }}
          style={styles.photo}
          contentFit="contain"
          accessibilityLabel={t('display.photoFrom', { name })}
        />
      )}

      {message.type === 'voice' && (
        <View style={styles.voice}>
          <Text style={styles.text}>{t('display.voiceFrom', { name })}</Text>
          {fileUri && <PlayButton uri={fileUri} onPlayingChange={onPlayingChange} />}
        </View>
      )}

      {message.type === 'text' && message.caption ? (
        <View style={styles.note}>
          <Text style={styles.noteText}>{message.caption}</Text>
        </View>
      ) : null}

      {message.type === 'photo' && message.caption ? (
        <Text style={styles.text}>{message.caption}</Text>
      ) : null}
    </View>
  );
}

/** Play / Stop for a voice message. Always starts from the beginning. */
function PlayButton({
  uri,
  onPlayingChange,
}: {
  uri: string;
  onPlayingChange?: (playing: boolean) => void;
}) {
  const { t } = useTranslation();
  // A new message gives a new `uri`, and with it a fresh player that isn't playing.
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);

  // Tell the screen whether we're playing, so it doesn't move on mid-message. The
  // cleanup also reports "stopped" when the button goes away (another message shown).
  useEffect(() => {
    onPlayingChange?.(status.playing);
    return () => onPlayingChange?.(false);
  }, [status.playing, onPlayingChange]);

  async function onPress() {
    if (status.playing) {
      player.pause();
      return;
    }
    // Play even if the tablet is set to silent.
    await setAudioModeAsync({ playsInSilentMode: true });
    player.seekTo(0);
    player.play();
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.playButton, pressed && styles.playButtonPressed]}
    >
      <Text style={styles.playLabel}>{status.playing ? t('display.stop') : t('display.play')}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  message: { flex: 1, gap: spacing.large, alignItems: 'center', justifyContent: 'center' },
  from: {
    fontSize: fontSizes.display,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
  },
  // flex: 1 lets the photo take all the room the text leaves.
  photo: { flex: 1, width: '100%', minHeight: 200 },
  text: {
    fontSize: fontSizes.display,
    lineHeight: fontSizes.display * 1.3,
    color: colors.text,
    textAlign: 'center',
  },
  note: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: spacing.xlarge,
    alignSelf: 'stretch',
  },
  noteText: {
    fontSize: fontSizes.displayTitle,
    lineHeight: fontSizes.displayTitle * 1.3,
    color: colors.text,
    textAlign: 'center',
  },
  voice: { alignItems: 'center', gap: spacing.xlarge },
  playButton: {
    // Far bigger than the 64dp minimum: this is the one button Grandma uses.
    minHeight: minTouchSize * 2,
    minWidth: minTouchSize * 5,
    borderRadius: minTouchSize,
    paddingHorizontal: spacing.xlarge,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonPressed: { opacity: 0.7 },
  playLabel: { fontSize: fontSizes.displayTitle, fontWeight: '700', color: colors.primaryText },
});
