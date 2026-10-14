// The first screen. It works out where this device belongs and sends it there:
//   - nothing set up yet       -> welcome
//   - signed in, display role  -> Grandma's display
//   - signed in, anything else -> the family home screen
// It remembers the answer, so next time it can start without internet.
import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { hasSavedSignIn, restoreSession } from '@/api/auth';
import { ApiError, toApiError } from '@/api/errors';
import { listMyFamilies } from '@/api/families';
import { Button, ErrorMessage, Screen } from '@/components/ui';
import { colors } from '@/components/theme';
import {
  forgetFamily,
  loadRememberedFamily,
  rememberFamily,
  type RememberedFamily,
} from '@/storage/remembered-family';

function routeFor({ familyId, role }: RememberedFamily) {
  const params = { familyId };
  return role === 'display'
    ? { pathname: '/display' as const, params }
    : { pathname: '/home' as const, params };
}

// How long to wait for the server before starting with the remembered family.
// A dead connection fails fast, but a bad one (Wi-Fi without internet) can hang.
const START_TIMEOUT_MS = 8 * 1000;

/** Like `promise`, but fails with a 'network' error if it takes longer than `ms`. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new ApiError('network')), ms);
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

/** Asks the server where this device belongs, and remembers the answer. */
async function checkWithServer(remembered: RememberedFamily | null) {
  const userId = await restoreSession();
  if (!userId) {
    // Offline, an expired sign-in looks like no sign-in (see hasSavedSignIn).
    // If one is saved, go where this device went last time.
    if (remembered && (await hasSavedSignIn())) {
      return routeFor(remembered);
    }
    return '/welcome' as const;
  }
  const [membership] = await listMyFamilies();
  if (!membership) {
    await forgetFamily();
    return '/welcome' as const;
  }
  const family = { familyId: membership.family.id, role: membership.role };
  await rememberFamily(family);
  return routeFor(family);
}

async function startRoute() {
  const remembered = await loadRememberedFamily();
  if (!remembered) {
    return checkWithServer(null);
  }
  try {
    return await withTimeout(checkWithServer(remembered), START_TIMEOUT_MS);
  } catch (caught) {
    // No internet: carry on with the family from last time.
    if (toApiError(caught).key === 'network' && (await hasSavedSignIn())) {
      return routeFor(remembered);
    }
    throw caught;
  }
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
