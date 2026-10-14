// The family home screen for senders, aides and admins: send a note, photo or
// voice message to Grandma, see the recent messages, and (admins) manage the family.
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getCurrentUserId, signOut } from '@/api/auth';
import { listMyFamilies, type Membership } from '@/api/families';
import { MessageList } from '@/components/message-list';
import { SendPhoto } from '@/components/send-photo';
import { SendText } from '@/components/send-text';
import { SendVoice } from '@/components/send-voice';
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

  useEffect(() => {
    run(async () => {
      const families = await listMyFamilies();
      setMembership(families.find((m) => m.family.id === familyId) ?? null);
      setCurrentUserId(await getCurrentUserId());
    });
    // Load once when the screen opens. (`run` changes on every redraw, so it is
    // deliberately left out of the list.)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId]);

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
          <Title>{t('home.greeting', { name: membership.displayName })}</Title>
          <Body muted>{t(`roles.${membership.role}`)}</Body>

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
