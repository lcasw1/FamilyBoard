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

  // For people already in a family, e.g. on a new phone. After signing in, the
  // start screen finds their family. Only the US server exists for now; once the
  // China server is running, this will need to ask which one.
  function signIn() {
    return run(async () => {
      await switchRegionForNewFamily();
      router.push('/sign-in');
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
      <Gap />
      <Button label={t('welcome.signIn')} onPress={signIn} variant="secondary" busy={busy} />
      <ErrorMessage error={error} />
    </Screen>
  );
}
