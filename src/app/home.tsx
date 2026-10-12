// The family home screen for senders, aides and admins: send a note, photo or
// voice message to Grandma, see the recent messages, and (admins) invite people.
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getCurrentUserId, signOut } from '@/api/auth';
import { createInvite, listMyFamilies, type Membership, type Role } from '@/api/families';
import { formatInviteCode } from '@/api/region';
import { MessageList } from '@/components/message-list';
import { SendPhoto } from '@/components/send-photo';
import { SendText } from '@/components/send-text';
import { SendVoice } from '@/components/send-voice';
import { Body, Button, ErrorMessage, Gap, Screen, Title } from '@/components/ui';
import { colors, fontSizes, spacing } from '@/components/theme';
import { useAction } from '@/hooks/use-action';
import { useMessages } from '@/hooks/use-messages';
import { resetTo } from '@/navigation';

// The roles an admin can invite, in the order the buttons appear.
const INVITE_ROLES: Role[] = ['sender', 'display', 'aide', 'admin'];

type NewInvite = { code: string; role: Role; expiresAt: Date };

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const { familyId } = useLocalSearchParams<{ familyId: string }>();
  const [membership, setMembership] = useState<Membership | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [invite, setInvite] = useState<NewInvite | null>(null);
  const { busy, error, run } = useAction();
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

  function makeInvite(role: Role) {
    return run(async () => {
      const validForDays = 7;
      const code = await createInvite(familyId, role, validForDays);
      const expiresAt = new Date(Date.now() + validForDays * 24 * 60 * 60 * 1000);
      setInvite({ code, role, expiresAt });
    });
  }

  function shareInvite(code: string) {
    Share.share({ message: t('home.shareMessage', { code: formatInviteCode(code) }) });
  }

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
            onDeleted={messages.reload}
          />
        </>
      )}

      {membership?.role === 'admin' && (
        <>
          <Gap />
          <Title>{t('home.invitesTitle')}</Title>
          {invite && (
            <View style={styles.inviteBox}>
              <Body>{t(`home.invite.${invite.role}`)}</Body>
              <Text style={styles.code} selectable>
                {formatInviteCode(invite.code)}
              </Text>
              <Body muted>
                {t('home.inviteExpires', {
                  date: invite.expiresAt.toLocaleDateString(i18n.language),
                })}
              </Body>
              <Button label={t('home.share')} onPress={() => shareInvite(invite.code)} />
            </View>
          )}
          {INVITE_ROLES.map((role) => (
            <Button
              key={role}
              label={t(`home.invite.${role}`)}
              onPress={() => makeInvite(role)}
              variant="secondary"
              disabled={busy}
            />
          ))}
        </>
      )}

      <ErrorMessage error={error} />
      <Gap />
      <Button label={t('home.signOut')} onPress={leave} variant="secondary" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  inviteBox: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.large,
    gap: spacing.medium,
  },
  code: {
    fontSize: fontSizes.large,
    fontWeight: '700',
    letterSpacing: 4,
    color: colors.text,
    textAlign: 'center',
  },
});
