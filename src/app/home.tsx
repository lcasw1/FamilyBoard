// The family home screen for senders, aides and admins: send a note, photo or
// voice message to Grandma, see the recent messages, and (admins) manage the family.
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getCurrentUserId, signOut } from '@/api/auth';
import { listMyFamilies, type Membership } from '@/api/families';
import { Avatar } from '@/components/avatar';
import { MessageList } from '@/components/message-list';
import { SendPhoto } from '@/components/send-photo';
import { SendText } from '@/components/send-text';
import { SendVoice } from '@/components/send-voice';
import { spacing } from '@/components/theme';
import { Body, Button, ErrorMessage, Gap, Screen, Title } from '@/components/ui';
import { useAction } from '@/hooks/use-action';
import { useMessages } from '@/hooks/use-messages';
import { resetTo } from '@/navigation';

export default function HomeScreen() {
  const { t } = useTranslation();
  const { familyId } = useLocalSearchParams<{ familyId: string }>();
  const [membership, setMembership] = useState<Membership | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const { error, run } = useAction();
  const messages = useMessages(familyId);
  const reloadMessages = messages.reload;

  // Load when the screen opens, and again when coming back to it (for example
  // after changing your name or photo), so the new ones show straight away.
  useFocusEffect(
    useCallback(() => {
      run(async () => {
        const families = await listMyFamilies();
        setMembership(families.find((m) => m.family.id === familyId) ?? null);
        setCurrentUserId(await getCurrentUserId());
      });
      reloadMessages();
      // `run` changes on every redraw, so it is deliberately left out of the list.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [familyId, reloadMessages]),
  );

  function leave() {
    return run(async () => {
      await signOut();
      resetTo('/welcome');
    });
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: membership?.family.name ?? t('app.name') }} />
      {membership && (
        <>
          <View style={styles.greeting}>
            <Avatar name={membership.displayName} photoPath={membership.photoPath} size={72} />
            <View style={styles.greetingText}>
              <Title>{t('home.greeting', { name: membership.displayName })}</Title>
              <Body muted>{t(`roles.${membership.role}`)}</Body>
            </View>
          </View>
          {currentUserId && (
            <Button
              label={t('home.editProfile')}
              onPress={() =>
                router.push({ pathname: '/profile', params: { familyId, userId: currentUserId } })
              }
              variant="secondary"
            />
          )}

          <Gap />
          <Title>{t('send.title')}</Title>
          <SendText familyId={familyId} onSent={messages.reload} />
          <SendPhoto familyId={familyId} onSent={messages.reload} />
          <SendVoice familyId={familyId} onSent={messages.reload} />

          <Gap />
          <Title>{t('messages.title')}</Title>
          <ErrorMessage error={messages.error} />
          <MessageList
            messages={messages.messages}
            members={messages.members}
            currentUserId={currentUserId}
            role={membership.role}
            onChanged={messages.reload}
          />
        </>
      )}

      {membership?.role === 'admin' && (
        <>
          <Gap />
          <Button
            label={t('home.manageFamily')}
            onPress={() => router.push({ pathname: '/family', params: { familyId } })}
            variant="secondary"
          />
        </>
      )}

      <ErrorMessage error={error} />
      <Gap />
      <Button label={t('home.signOut')} onPress={leave} variant="secondary" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  greeting: { flexDirection: 'row', alignItems: 'center', gap: spacing.medium },
  // flex: 1 lets a long name wrap instead of running off the screen.
  greetingText: { flex: 1 },
});
