// Record a voice message, listen to it, then send it or record again.
//
// Three steps, worked out from the state below:
//   1. nothing recorded yet    -> "Record a voice message" button
//   2. recording               -> timer and "Stop" button (stops by itself at the limit)
//   3. recorded (recordingUri) -> "Listen", "Send" and "Record again" buttons
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ApiError } from '@/api/errors';
import { sendVoiceMessage } from '@/api/messages';
import { useAction } from '@/hooks/use-action';

import { colors, fontSizes, spacing } from './theme';
import { Button, ErrorMessage } from './ui';

const MAX_RECORDING_SECONDS = 3 * 60;

// One channel (mono) at 64 kbps is plenty for a voice and keeps files small:
// a 3-minute message is about 1.5 MB. The file is an .m4a, which the bucket accepts.
const RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  numberOfChannels: 1,
  bitRate: 64000,
};

/** 75000 -> '1:15'. */
function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function SendVoice({ familyId, onSent }: { familyId: string; onSent: () => void }) {
  const { t } = useTranslation();
  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  // Re-reads the recorder twice a second, so the timer below stays current.
  const recorderState = useAudioRecorderState(recorder);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  // A player for the finished recording, so the sender can hear it before sending.
  const player = useAudioPlayer(recordingUri);
  const playerStatus = useAudioPlayerStatus(player);
  const { busy, error, run } = useAction();

  function start() {
    return run(async () => {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        throw new ApiError('microphone_permission');
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    });
  }

  function stop() {
    return run(async () => {
      await recorder.stop();
      // Switch back to playback mode, so "Listen" uses the loudspeaker on iPhones.
      await setAudioModeAsync({ allowsRecording: false });
      setRecordingUri(recorder.uri);
    });
  }

  // Stop by itself when the time limit is reached.
  useEffect(() => {
    if (recorderState.isRecording && recorderState.durationMillis >= MAX_RECORDING_SECONDS * 1000) {
      stop();
    }
    // Only re-check when the timer moves. (`stop` changes on every redraw, so it
    // is deliberately left out of the list.)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorderState.isRecording, recorderState.durationMillis]);

  function listen() {
    if (playerStatus.playing) {
      player.pause();
      return;
    }
    // Always start from the beginning, including after it played to the end.
    player.seekTo(0);
    player.play();
  }

  function send(uri: string) {
    return run(async () => {
      player.pause();
      await sendVoiceMessage(familyId, uri);
      setRecordingUri(null);
      onSent();
    });
  }

  function discard() {
    player.pause();
    setRecordingUri(null);
  }

  if (recorderState.isRecording) {
    return (
      <View style={styles.box}>
        <Text style={styles.timer} accessibilityLiveRegion="polite">
          {t('send.recording', {
            time: formatDuration(recorderState.durationMillis),
            max: formatDuration(MAX_RECORDING_SECONDS * 1000),
          })}
        </Text>
        <Button label={t('send.stopRecording')} onPress={stop} busy={busy} />
        <ErrorMessage error={error} />
      </View>
    );
  }

  if (recordingUri) {
    return (
      <View style={styles.box}>
        <Text style={styles.timer}>
          {t('send.recorded', { time: formatDuration(playerStatus.duration * 1000) })}
        </Text>
        <Button
          label={playerStatus.playing ? t('send.stopListening') : t('send.listen')}
          onPress={listen}
          variant="secondary"
          disabled={busy}
        />
        <Button label={t('send.sendVoice')} onPress={() => send(recordingUri)} busy={busy} />
        <Button
          label={t('send.recordAgain')}
          onPress={discard}
          variant="secondary"
          disabled={busy}
        />
        <ErrorMessage error={error} />
      </View>
    );
  }

  return (
    <>
      <Button label={t('send.recordVoice')} onPress={start} variant="secondary" busy={busy} />
      <ErrorMessage error={error} />
    </>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.medium,
    gap: spacing.medium,
  },
  timer: {
    fontSize: fontSizes.body,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
});
