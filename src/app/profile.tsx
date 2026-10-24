// Name and photo for one family member. Opened from the home screen (your own)
// and from Manage family (admins, for anyone). The database checks who may change
// what; this screen just collects the new name and photo.
//
// Nothing is saved until Save: a picked photo is only shown here first.
import * as ImagePicker from 'expo-image-picker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getCurrentUserId } from '@/api/auth';
import { ApiError } from '@/api/errors';
import { listMembers, updateMemberProfile, type Member } from '@/api/families';
import { deleteMedia, uploadLocalFile } from '@/api/media';
import { Avatar } from '@/components/avatar';
import { spacing } from '@/components/theme';
import { Body, Button, ErrorMessage, Gap, Screen, TextField } from '@/components/ui';
import { useAction } from '@/hooks/use-action';
import { prepareAvatar } from '@/media/photo';

const MAX_NAME_LENGTH = 50;

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { familyId, userId } = useLocalSearchParams<{ familyId: string; userId: string }>();
  const [member, setMember] = useState<Member | null>(null);
  const [isYou, setIsYou] = useState(false);
  const [name, setName] = useState('');
  // The photo to save: undefined = keep the current one, null = remove it,
  // a string = a newly picked photo on this phone, not uploaded yet.
  const [newPhoto, setNewPhoto] = useState<string | null | undefined>(undefined);
  const { busy, error, run } = useAction();

  useEffect(() => {
    run(async () => {
      const [members, currentUserId] = await Promise.all([
        listMembers(familyId),
        getCurrentUserId(),
      ]);
      const found = members.find((m) => m.user_id === userId) ?? null;
      setMember(found);
      setName(found?.display_name ?? '');
      setIsYou(currentUserId === userId);
    });
    // Load once when the screen opens. (`run` changes on every redraw.)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId, userId]);

  function pick(source: 'camera' | 'library') {
    return run(async () => {
      // allowsEditing + aspect: Android shows a crop step, so the photo is square.
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
      };
      let result: ImagePicker.ImagePickerResult;
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          throw new ApiError('camera_permission');
        }
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        result = await ImagePicker.launchImageLibraryAsync(options);
      }
      if (result.canceled) {
        return;
      }
      const asset = result.assets[0];
      setNewPhoto(await prepareAvatar(asset.uri, asset.width, asset.height));
    });
  }

  function save(current: Member) {
    return run(async () => {
      const trimmed = name.trim();
      if (trimmed.length === 0 || trimmed.length > MAX_NAME_LENGTH) {
        throw new ApiError('invalid_display_name');
      }
      const oldPath = current.photo_path;
      let photoPath: string | null | undefined = undefined;
      if (typeof newPhoto === 'string') {
        photoPath = await uploadLocalFile(familyId, newPhoto);
      } else if (newPhoto === null) {
        photoPath = null;
      }
      await updateMemberProfile(familyId, userId, { displayName: trimmed, photoPath });
      // The old photo isn't used any more. If deleting it fails, it's only a
      // leftover file, so don't bother the user with an error.
      if (photoPath !== undefined && oldPath) {
        deleteMedia(oldPath).catch(() => {});
      }
      router.back();
    });
  }

  // What the circle shows: the picked photo, nothing (removed), or the saved one.
  const shownPath = newPhoto === undefined ? member?.photo_path : null;
  const hasPhoto = typeof newPhoto === 'string' || (newPhoto === undefined && !!member?.photo_path);

  return (
    <Screen>
      <Stack.Screen options={{ title: t('profile.title') }} />
      {member && (
        <>
          <View style={styles.avatar}>
            <Avatar
              name={name || member.display_name}
              photoPath={shownPath}
              localUri={typeof newPhoto === 'string' ? newPhoto : null}
              size={160}
            />
          </View>
          <Body muted>{t('profile.photoHint')}</Body>
          <Button
            label={t('send.takePhoto')}
            onPress={() => pick('camera')}
            variant="secondary"
            busy={busy}
          />
          <Button
            label={t('send.choosePhoto')}
            onPress={() => pick('library')}
            variant="secondary"
            busy={busy}
          />
          {hasPhoto && (
            <Button
              label={t('profile.removePhoto')}
              onPress={() => setNewPhoto(null)}
              variant="secondary"
              disabled={busy}
            />
          )}

          <Gap />
          <TextField
            label={isYou ? t('join.nameLabel') : t('profile.nameLabelOther')}
            value={name}
            onChangeText={setName}
            maxLength={MAX_NAME_LENGTH}
          />
          <Button label={t('profile.save')} onPress={() => save(member)} busy={busy} />
        </>
      )}
      <ErrorMessage error={error} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', paddingVertical: spacing.medium },
});
