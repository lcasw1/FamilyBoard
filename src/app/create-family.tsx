import { Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { createFamily, type DisplayLanguage } from '@/api/families';
import { deviceLanguage } from '@/i18n';
import { Body, Button, ErrorMessage, Screen, TextField } from '@/components/ui';
import { spacing } from '@/components/theme';
import { useAction } from '@/hooks/use-action';
import { resetTo } from '@/navigation';

const LANGUAGES: DisplayLanguage[] = ['zh-CN', 'en'];

export default function CreateFamilyScreen() {
  const { t } = useTranslation();
  const [familyName, setFamilyName] = useState('');
  const [yourName, setYourName] = useState('');
  const [language, setLanguage] = useState<DisplayLanguage>(deviceLanguage());
  const { busy, error, run } = useAction();

  const ready = familyName.trim().length > 0 && yourName.trim().length > 0;

  function submit() {
    return run(async () => {
      const familyId = await createFamily({
        name: familyName,
        displayLanguage: language,
        adminDisplayName: yourName,
      });
      resetTo({ pathname: '/home', params: { familyId } });
    });
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: t('createFamily.title') }} />
      <TextField
        label={t('createFamily.familyNameLabel')}
        placeholder={t('createFamily.familyNamePlaceholder')}
        value={familyName}
        onChangeText={setFamilyName}
        autoCapitalize="words"
      />
      <TextField
        label={t('createFamily.yourNameLabel')}
        value={yourName}
        onChangeText={setYourName}
        autoCapitalize="words"
      />
      <Body>{t('createFamily.languageLabel')}</Body>
      <View style={styles.row}>
        {LANGUAGES.map((option) => (
          <View key={option} style={styles.option}>
            <Button
              label={t(`languages.${option}`)}
              onPress={() => setLanguage(option)}
              variant={option === language ? 'primary' : 'secondary'}
            />
          </View>
        ))}
      </View>
      <ErrorMessage error={error} />
      <Button label={t('createFamily.create')} onPress={submit} busy={busy} disabled={!ready} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.medium },
  option: { flex: 1 },
});
