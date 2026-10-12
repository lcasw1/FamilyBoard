// Grandma's display. Placeholder until phase 5 (day clock, latest message,
// Play button, offline cache, keep-awake).
import { Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, fontSizes, spacing } from '@/components/theme';

export default function DisplayScreen() {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <Text style={styles.text}>{t('display.waiting')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xlarge,
    backgroundColor: colors.background,
  },
  text: { fontSize: fontSizes.display, color: colors.text, textAlign: 'center' },
});
