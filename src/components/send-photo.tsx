// Take or choose a photo, add an optional caption, and send it.
//
// The photo is shrunk on the phone first (see src/media/photo.ts). Nothing is
// uploaded until the user presses Send, so they can check the photo first.
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ApiError } from '@/api/errors';
import { sendPhotoMessage } from '@/api/messages';
import { useAction } from '@/hooks/use-action';
import { preparePhotoForSending } from '@/media/photo';

import { colors, spacing } from './theme';
import { Button, ErrorMessage, TextField } from './ui';

const MAX_CAPTION_LENGTH = 500;

export function SendPhoto({ familyId, onSent }: { familyId: string; onSent: () => void }) {
  const { t } = useTranslation();
  // The URI of the resized photo waiting to be sent, or null when none is picked.
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const { busy, error, run } = useAction();

  function pick(source: 'camera' | 'library') {
    return run(async () => {
      let result: ImagePicker.ImagePickerResult;
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          throw new ApiError('camera_permission');
        }
        result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'] });
      } else {
        // Android's photo picker needs no permission: the user picks one photo
        // and the app only ever sees that one.
        result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] });
      }
      if (result.canceled) {
        return;
      }
      const asset = result.assets[0];
      setPhotoUri(await preparePhotoForSending(asset.uri, asset.width, asset.height));
    });
  }

  function send(uri: string) {
    return run(async () => {
      await sendPhotoMessage(familyId, uri, caption);
      cancel();
      onSent();
    });
  }

  function cancel() {
    setPhotoUri(null);
    setCaption('');
  }

  if (!photoUri) {
    return (
      <>
        <View style={styles.row}>
          <View style={styles.half}>
            <Button
              label={t('send.takePhoto')}
              onPress={() => pick('camera')}
              variant="secondary"
              disabled={busy}
            />
          </View>
          <View style={styles.half}>
            <Button
              label={t('send.choosePhoto')}
              onPress={() => pick('library')}
              variant="secondary"
              disabled={busy}
            />
          </View>
        </View>
        <ErrorMessage error={error} />
      </>
    );
  }

  return (
    <View style={styles.preview}>
      <Image
        source={{ uri: photoUri }}
        style={styles.photo}
        contentFit="contain"
        accessibilityLabel={t('send.photoPreview')}
      />
      <TextField
        label={t('send.captionLabel')}
        placeholder={t('send.captionPlaceholder')}
        value={caption}
        onChangeText={setCaption}
        multiline
        maxLength={MAX_CAPTION_LENGTH}
      />
      <Button label={t('send.sendPhoto')} onPress={() => send(photoUri)} busy={busy} />
      <Button label={t('send.cancel')} onPress={cancel} variant="secondary" disabled={busy} />
      <ErrorMessage error={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.medium },
  // Two buttons side by side, each taking half the width.
  half: { flex: 1 },
  preview: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.medium,
    gap: spacing.medium,
  },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: 8 },
});
