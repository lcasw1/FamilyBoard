// One-time setup of Grandma's tablet: an admin types a display invite code.
// The tablet signs in without an email and stays signed in from then on.
import { Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getCurrentUserId, signInDisplayDevice } from '@/api/auth';
import { redeemInvite, switchRegionForInvite } from '@/api/families';
import { Body, Button, ErrorMessage, Screen, TextField } from '@/components/ui';
import { useAction } from '@/hooks/use-action';
import { resetTo } from '@/navigation';

export default function TabletSetupScreen() {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [name, setName] = useState(t('tabletSetup.defaultName'));
  const { busy, error, run } = useAction();

  const ready = code.trim().length > 0 && name.trim().length > 0;

  function submit() {
    return run(async () => {
      await switchRegionForInvite(code);
      // After a failed attempt (e.g. a mistyped code) the tablet is already
      // signed in; reuse that session instead of creating another account.
      if (!(await getCurrentUserId())) {
        await signInDisplayDevice();
      }
      const familyId = await redeemInvite(code, name);
      resetTo({ pathname: '/display', params: { familyId } });
    });
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: t('tabletSetup.title') }} />
      <Body>{t('tabletSetup.intro')}</Body>
      <TextField
        label={t('tabletSetup.codeLabel')}
        placeholder="US-7K3QXM"
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
        autoCorrect={false}
      />
      <TextField label={t('tabletSetup.nameLabel')} value={name} onChangeText={setName} />
      <ErrorMessage error={error} />
      <Button label={t('tabletSetup.submit')} onPress={submit} busy={busy} disabled={!ready} />
    </Screen>
  );
}
