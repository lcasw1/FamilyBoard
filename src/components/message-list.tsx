// The family's recent messages, newest first, as the senders see them.
// Each message shows who sent it and when (in this phone's time zone). People
// can delete their own messages; admins can delete any.
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Member, Role } from '@/api/families';
import { getSignedUrl } from '@/api/media';
import { deleteMessage, type Message } from '@/api/messages';
import { useAction } from '@/hooks/use-action';

import { colors, fontSizes, spacing } from './theme';
import { Body, Button, ErrorMessage } from './ui';

type MessageListProps = {
  messages: Message[];
  members: Member[];
  currentUserId: string | null;
  role: Role;
  onDeleted: () => void;
};

export function MessageList({
  messages,
  members,
  currentUserId,
  role,
  onDeleted,
}: MessageListProps) {
  const { t } = useTranslation();
  const { busy, error, run } = useAction();

  // user id -> display name, e.g. { 'a1b2...': 'Lily' }.
  const names = new Map(members.map((member) => [member.user_id, member.display_name]));

  function confirmDelete(message: Message) {
    Alert.alert(t('messages.deleteTitle'), t('messages.deleteBody'), [
      { text: t('send.cancel'), style: 'cancel' },
      {
        text: t('messages.delete'),
        style: 'destructive',
        onPress: () =>
          run(async () => {
            await deleteMessage(message);
            onDeleted();
          }),
      },
    ]);
  }

  if (messages.length === 0) {
    return <Body muted>{t('messages.empty')}</Body>;
  }

  return (
    <>
      <ErrorMessage error={error} />
      {messages.map((message) => (
        <MessageItem
          key={message.id}
          message={message}
          senderName={names.get(message.sender_id) ?? t('messages.formerMember')}
          canDelete={message.sender_id === currentUserId || role === 'admin'}
          deleting={busy}
          onDelete={() => confirmDelete(message)}
        />
      ))}
    </>
  );
}

type MessageItemProps = {
  message: Message;
  senderName: string;
  canDelete: boolean;
  deleting: boolean;
  onDelete: () => void;
};

function MessageItem({ message, senderName, canDelete, deleting, onDelete }: MessageItemProps) {
  const { t, i18n } = useTranslation();
  // created_at is stored in UTC; toLocaleString shows it in this phone's time zone.
  const sentAt = new Date(message.created_at).toLocaleString(i18n.language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <View style={styles.item}>
      <Text style={styles.meta}>
        {t('messages.from', { name: senderName, time: sentAt })}
      </Text>
      {message.hidden && <Text style={styles.hidden}>{t('messages.hidden')}</Text>}
      {message.type === 'photo' && message.file_path && <MessagePhoto path={message.file_path} />}
      {message.type === 'voice' && <Body>{t('messages.voice')}</Body>}
      {message.caption ? <Body>{message.caption}</Body> : null}
      {canDelete && (
        <Button
          label={t('messages.delete')}
          onPress={onDelete}
          variant="secondary"
          disabled={deleting}
        />
      )}
    </View>
  );
}

/** Shows a photo from the private bucket through a short-lived signed link. */
function MessagePhoto({ path }: { path: string }) {
  const { t } = useTranslation();
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSignedUrl(path)
      .then((signedUrl) => {
        if (!cancelled) setUri(signedUrl);
      })
      // If the link can't be made (e.g. offline), keep showing the grey box.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [path]);

  return (
    <View style={styles.photo}>
      {uri && (
        <Image
          // The signed link changes every time, so tell expo-image to cache the
          // photo by its storage path instead; then it is downloaded only once.
          source={{ uri, cacheKey: path }}
          style={styles.fill}
          contentFit="cover"
          accessibilityLabel={t('messages.photo')}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.medium,
    gap: spacing.small,
  },
  meta: { fontSize: fontSizes.body, fontWeight: '600', color: colors.textMuted },
  hidden: { fontSize: fontSizes.body, fontStyle: 'italic', color: colors.textMuted },
  photo: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  fill: { width: '100%', height: '100%' },
});
