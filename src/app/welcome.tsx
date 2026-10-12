import { router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { getCurrentUserId } from '@/api/auth';
import { switchRegionForNewFamily } from '@/api/families';
import { Body, Button, ErrorMessage, Gap, Screen, Title } from '@/components/ui';
import { useAction } from '@/hooks/use-action';

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const { busy, error, run } = useAction();

  function startFamily() {
    return run(async () => {
      await switchRegionForNewFamily();
      if (await getCurrentUserId()) {
        router.push('/create-family');
      } else {
        router.push({ pathname: '/sign-in', params: { next: 'create' } });
      }
    });
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: t('app.name') }} />
      <Title>{t('welcome.title')}</Title>
      <Body>{t('welcome.intro')}</Body>
      <Gap />
      <Button label={t('welcome.join')} onPress={() => router.push('/join')} />
      <Button label={t('welcome.create')} onPress={startFamily} variant="secondary" busy={busy} />
      <Button
        label={t('welcome.tablet')}
        onPress={() => router.push('/tablet-setup')}
        variant="secondary"
      />
      <ErrorMessage error={error} />
    </Screen>
  );
}
