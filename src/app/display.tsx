// Grandma's display: the day clock and the family's newest message. She never has
// to operate it; the only button is Play on a voice message.
//
// The screen stays on, uses the language the family chose for it, and keeps
// showing the last message when the internet is down.
import { Stack, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useKeepAwake } from 'expo-keep-awake';
import { useEffect } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { DayClock } from '@/components/day-clock';
import { DisplayMessage } from '@/components/display-message';
import { colors, fontSizes, spacing } from '@/components/theme';
import { useDisplayFeed } from '@/hooks/use-display-feed';

export default function DisplayScreen() {
  const { familyId } = useLocalSearchParams<{ familyId: string }>();
  const { t, i18n } = useTranslation();
  const snapshot = useDisplayFeed(familyId);
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
        {snapshot?.message ? (
          <DisplayMessage message={snapshot.message} senderName={snapshot.senderName} />
        ) : (
          <Text style={styles.waiting}>{t('display.waiting')}</Text>
        )}
      </View>
    </View>
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
  waiting: {
    fontSize: fontSizes.display,
    lineHeight: fontSizes.display * 1.3,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
