// Join a family with an invite code. The code's first letters pick the server,
// so this happens before signing in.
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getCurrentUserId } from '@/api/auth';
import { redeemInvite, switchRegionForInvite } from '@/api/families';
import { Body, Button, ErrorMessage, Screen, TextField } from '@/components/ui';
import { useAction } from '@/hooks/use-action';
import { resetTo } from '@/navigation';

export default function JoinScreen() {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const { busy, error, run } = useAction();

  const ready = code.trim().length > 0 && name.trim().length > 0;

  function submit() {
    return run(async () => {
      await switchRegionForInvite(code);
      if (await getCurrentUserId()) {
        // Already signed in (e.g. joining a second family): join straight away.
        await redeemInvite(code, name);
        resetTo('/');
      } else {
        router.push({ pathname: '/sign-in', params: { next: 'join', code, name } });
      }
    });
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: t('join.title') }} />
      <Body>{t('join.intro')}</Body>
      <TextField
        label={t('join.codeLabel')}
        placeholder="US-7K3QXM"
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
        autoCorrect={false}
      />
      <TextField
        label={t('join.nameLabel')}
        placeholder={t('join.namePlaceholder')}
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
      />
      <ErrorMessage error={error} />
      <Button label={t('common.continue')} onPress={submit} busy={busy} disabled={!ready} />
    </Screen>
  );
}
