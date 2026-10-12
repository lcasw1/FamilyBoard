// A box for writing a short note to Grandma, with a Send button.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { sendTextMessage } from '@/api/messages';
import { useAction } from '@/hooks/use-action';

import { Button, ErrorMessage, TextField } from './ui';

// The database allows up to 500 characters (see the migration).
const MAX_NOTE_LENGTH = 500;

export function SendText({ familyId, onSent }: { familyId: string; onSent: () => void }) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const { busy, error, run } = useAction();

  function send() {
    return run(async () => {
      await sendTextMessage(familyId, text);
      setText('');
      onSent();
    });
  }

  return (
    <>
      <TextField
        label={t('send.noteLabel')}
        placeholder={t('send.notePlaceholder')}
        value={text}
        onChangeText={setText}
        multiline
        maxLength={MAX_NOTE_LENGTH}
      />
      <Button
        label={t('send.sendNote')}
        onPress={send}
        busy={busy}
        disabled={text.trim() === ''}
      />
      <ErrorMessage error={error} />
    </>
  );
}
