// Manage family (admins only): change members' roles, remove members, create
// invite codes, and cancel codes that haven't been used yet.
//
// The database enforces all of this (only admins, never the last admin, the
// tablet keeps its role); this screen just offers the buttons that make sense.
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Share, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getCurrentUserId } from '@/api/auth';
import { toApiError, type ApiError } from '@/api/errors';
import {
  createInvite,
  listMembers,
  listOpenInvites,
  removeMember,
  revokeInvite,
  setMemberRole,
  type Invite,
  type Member,
  type Role,
} from '@/api/families';
import { formatInviteCode } from '@/api/region';
import { colors, fontSizes, spacing } from '@/components/theme';
import { Body, Button, ErrorMessage, Gap, Screen, Title } from '@/components/ui';
import { useAction } from '@/hooks/use-action';
import { formatDate } from '@/i18n/format-date';

// The roles an admin can invite, in the order the buttons appear.
const INVITE_ROLES: Role[] = ['sender', 'display', 'aide', 'admin'];
// The roles a member can be switched between (the tablet always stays 'display').
const CHANGEABLE_ROLES: Role[] = ['sender', 'aide', 'admin'];
const INVITE_VALID_DAYS = 7;

export default function FamilyScreen() {
  const { t } = useTranslation();
  const { familyId } = useLocalSearchParams<{ familyId: string }>();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const { busy, error, run } = useAction();

  // Loads members and open invites. State is set only once the answers arrive.
  const reload = useCallback(() => {
    Promise.all([listMembers(familyId), listOpenInvites(familyId), getCurrentUserId()]).then(
      ([newMembers, newInvites, userId]) => {
        setMembers(newMembers);
        setInvites(newInvites);
        setCurrentUserId(userId);
        setLoadError(null);
      },
      (caught) => setLoadError(toApiError(caught)),
    );
  }, [familyId]);

  useEffect(() => {
    reload();
  }, [reload]);

  function changeRole(member: Member, role: Role) {
    return run(async () => {
      await setMemberRole(familyId, member.user_id, role);
      reload();
    });
  }

  function confirmRemove(member: Member) {
    const body = member.role === 'display' ? t('family.removeDisplayBody') : t('family.removeBody');
    Alert.alert(t('family.removeTitle', { name: member.display_name }), body, [
      { text: t('family.cancel'), style: 'cancel' },
      {
        text: t('family.remove'),
        style: 'destructive',
        onPress: () =>
          run(async () => {
            await removeMember(familyId, member.user_id);
            reload();
          }),
      },
    ]);
  }

  function makeInvite(role: Role) {
    return run(async () => {
      await createInvite(familyId, role, INVITE_VALID_DAYS);
      // The new code appears first in the list of codes, just above the buttons.
      reload();
    });
  }

  function revoke(invite: Invite) {
    return run(async () => {
      await revokeInvite(invite.id);
      reload();
    });
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: t('family.title') }} />
      <ErrorMessage error={loadError} />
      <ErrorMessage error={error} />

      <Title>{t('family.membersTitle')}</Title>
      {members.map((member) => (
        <MemberCard
          key={member.user_id}
          member={member}
          isYou={member.user_id === currentUserId}
          busy={busy}
          onChangeRole={(role) => changeRole(member, role)}
          onRemove={() => confirmRemove(member)}
        />
      ))}

      <Gap />
      <Title>{t('family.invitesTitle')}</Title>
      {/* Codes waiting to be used, newest first, above the buttons so a new code
          shows up right where the admin is looking. */}
      {invites.map((invite) => (
        <InviteCard key={invite.id} invite={invite} busy={busy} onRevoke={() => revoke(invite)} />
      ))}
      {INVITE_ROLES.map((role) => (
        <Button
          key={role}
          label={t(`family.invite.${role}`)}
          onPress={() => makeInvite(role)}
          variant="secondary"
          disabled={busy}
        />
      ))}
    </Screen>
  );
}

type MemberCardProps = {
  member: Member;
  isYou: boolean;
  busy: boolean;
  onChangeRole: (role: Role) => void;
  onRemove: () => void;
};

function MemberCard({ member, isYou, busy, onChangeRole, onRemove }: MemberCardProps) {
  const { t } = useTranslation();
  const role = member.role as Role;
  // Admins don't change or remove themselves here, so nobody locks themselves
  // out by accident. Another admin can do it for them.
  const otherRoles = isYou || role === 'display' ? [] : CHANGEABLE_ROLES.filter((r) => r !== role);

  return (
    <View style={styles.card}>
      <Text style={styles.name}>
        {isYou ? t('family.you', { name: member.display_name }) : member.display_name}
      </Text>
      <Body muted>{t(`roles.${role}`)}</Body>
      {otherRoles.map((newRole) => (
        <Button
          key={newRole}
          label={t(`family.makeRole.${newRole}`)}
          onPress={() => onChangeRole(newRole)}
          variant="secondary"
          disabled={busy}
        />
      ))}
      {!isYou && (
        <Button label={t('family.remove')} onPress={onRemove} variant="secondary" disabled={busy} />
      )}
    </View>
  );
}

function InviteCard({
  invite,
  busy,
  onRevoke,
}: {
  invite: Invite;
  busy: boolean;
  onRevoke: () => void;
}) {
  const { t, i18n } = useTranslation();
  const code = formatInviteCode(invite.code);

  function share() {
    Share.share({ message: t('family.shareMessage', { code }) });
  }

  return (
    <View style={styles.card}>
      <Body>{t(`family.invite.${invite.role as Role}`)}</Body>
      <Text style={styles.code} selectable>
        {code}
      </Text>
      <Body muted>
        {t('family.inviteExpires', {
          // expires_at is stored in UTC; formatDate shows it in this phone's time zone.
          date: formatDate(new Date(invite.expires_at), i18n.language, { dateStyle: 'medium' }),
        })}
      </Body>
      <Button label={t('family.share')} onPress={share} />
      <Button label={t('family.revoke')} onPress={onRevoke} variant="secondary" disabled={busy} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.large,
    gap: spacing.medium,
  },
  name: { fontSize: fontSizes.title, fontWeight: '700', color: colors.text },
  code: {
    fontSize: fontSizes.large,
    fontWeight: '700',
    letterSpacing: 4,
    color: colors.text,
    textAlign: 'center',
  },
});
