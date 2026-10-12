// The first screen. It works out where this device belongs and sends it there:
//   - nothing set up yet       -> welcome
//   - signed in, display role  -> Grandma's display
//   - signed in, anything else -> the family home screen
import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { restoreSession } from '@/api/auth';
import { toApiError, type ApiError } from '@/api/errors';
import { listMyFamilies } from '@/api/families';
import { Button, ErrorMessage, Screen } from '@/components/ui';
import { colors } from '@/components/theme';

async function startRoute() {
  if (!(await restoreSession())) {
    return '/welcome' as const;
  }
  // TODO(phase 5): remember the family on the device so the tablet can start offline.
  const [membership] = await listMyFamilies();
  if (!membership) {
    return '/welcome' as const;
  }
  const params = { familyId: membership.family.id };
  return membership.role === 'display'
    ? { pathname: '/display' as const, params }
    : { pathname: '/home' as const, params };
}

export default function StartScreen() {
  const { t } = useTranslation();
  const [error, setError] = useState<ApiError | null>(null);
  // Bumping `attempt` re-runs the effect below (the "Try again" button).
  const [attempt, setAttempt] = useState(0);

  // useEffect runs code after the screen is drawn; the list at the end says when
  // to run it again. The returned function runs if the screen goes away first.
  useEffect(() => {
    let cancelled = false;
    startRoute()
      .then((route) => {
        if (!cancelled) router.replace(route);
      })
      .catch((caught) => {
        if (!cancelled) setError(toApiError(caught));
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      {error ? (
        <Screen>
          <ErrorMessage error={error} />
          <Button
            label={t('common.tryAgain')}
            onPress={() => {
              setError(null);
              setAttempt(attempt + 1);
            }}
          />
        </Screen>
      ) : (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
