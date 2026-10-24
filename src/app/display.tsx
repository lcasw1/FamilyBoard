// Grandma's display: the day clock and the family's messages from the last day,
// taking turns (newest first; see useRotation). She never has to operate it. The
// only buttons are Play on a voice message, and Earlier / Later, which Grandpa or
// the aide can use to look back with her.
//
// The screen stays on, uses the language the family chose for it, and keeps
// showing the last message when the internet is down.
import { Stack, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useKeepAwake } from 'expo-keep-awake';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { DayClock } from '@/components/day-clock';
import { DisplayMessage } from '@/components/display-message';
import { colors, fontSizes, minTouchSize, spacing } from '@/components/theme';
import { useDisplayFeed } from '@/hooks/use-display-feed';
import { useRotation } from '@/hooks/use-rotation';

export default function DisplayScreen() {
  const { familyId } = useLocalSearchParams<{ familyId: string }>();
  const { t, i18n } = useTranslation();
  const snapshot = useDisplayFeed(familyId);
  const items = snapshot?.items ?? [];
  // True while a voice message is playing: the rotation waits until it ends.
  const [playing, setPlaying] = useState(false);
  const { index, go } = useRotation(
    items.map((item) => item.message.id),
    playing,
  );
  const shown = items[index];
  // Side by side on a tablet lying sideways; clock above the message when upright.
  const { width, height } = useWindowDimensions();
  const sideways = width > height;

  // Keep the screen on for as long as this screen is open.
  useKeepAwake();

  // Switch the whole app to the family's chosen language for the tablet.
  const language = snapshot?.language;
  useEffect(() => {
    if (language && i18n.language !== language) {
      i18n.changeLanguage(language);
    }
  }, [language, i18n]);

  return (
    <View style={[styles.screen, sideways && styles.sideways]}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar hidden />
      <View style={sideways ? styles.clockSideways : styles.clockUpright}>
        <DayClock />
      </View>
      <View style={styles.message}>
        {shown ? (
          <DisplayMessage
            // A new key for each message gives it a fresh voice player.
            key={shown.message.id}
            message={shown.message}
            senderName={shown.senderName}
            senderPhotoPath={shown.senderPhotoPath}
            onPlayingChange={setPlaying}
          />
        ) : (
          <Text style={styles.waiting}>{t('display.waiting')}</Text>
        )}
        {items.length > 1 && (
          <View style={styles.nav}>
            {/* Numbered oldest first, like a timeline: the newest is "5 of 5". */}
            <Text style={styles.position}>
              {t('display.position', { current: items.length - index, total: items.length })}
            </Text>
            <View style={styles.navButtons}>
              {/* Items are newest first, so "earlier" is a step further down the list. */}
              <NavButton
                label={t('display.earlier')}
                onPress={() => go(+1)}
                disabled={index === items.length - 1}
              />
              <NavButton label={t('display.later')} onPress={() => go(-1)} disabled={index === 0} />
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

function NavButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.navButton,
        pressed && styles.navPressed,
        disabled && styles.navDisabled,
      ]}
    >
      {/* On a narrow screen, shrink the label a little rather than cut it off. */}
      <Text style={styles.navLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: spacing.xlarge,
    gap: spacing.xlarge,
    backgroundColor: colors.background,
  },
  sideways: { flexDirection: 'row' },
  // flexBasis: 0 makes the split exactly 2 : 3 of the width, whatever is inside.
  clockSideways: { flex: 2, flexBasis: 0, justifyContent: 'center' },
  clockUpright: { paddingTop: spacing.large },
  message: { flex: 3, flexBasis: 0, justifyContent: 'center' },
  nav: { gap: spacing.small },
  navButtons: { flexDirection: 'row', gap: spacing.medium },
  navButton: {
    // Both buttons share the row equally.
    flex: 1,
    minHeight: minTouchSize,
    paddingHorizontal: spacing.large,
    borderRadius: minTouchSize / 2,
    borderWidth: 3,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navPressed: { opacity: 0.6 },
  // Still visible (so the buttons don't jump around), but clearly not usable.
  navDisabled: { opacity: 0.25 },
  navLabel: { fontSize: fontSizes.large, fontWeight: '600', color: colors.primary },
  position: { fontSize: fontSizes.large, color: colors.textMuted, textAlign: 'center' },
  waiting: {
    fontSize: fontSizes.display,
    lineHeight: fontSizes.display * 1.3,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
