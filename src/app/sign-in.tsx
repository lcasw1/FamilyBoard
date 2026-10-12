// Email sign-in in two steps: enter your email, then the 6-digit code we email you.
//
// Route params say what to do afterwards:
//   next=join   (with code and name) -> join that family
//   next=create                      -> go on to create a family
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { sendEmailCode, verifyEmailCode } from '@/api/auth';
import { redeemInvite } from '@/api/families';
import { Body, Button, ErrorMessage, Screen, TextField } from '@/components/ui';
import { useAction } from '@/hooks/use-action';
import { resetTo } from '@/navigation';

type Params = { next?: 'join' | 'create'; code?: string; name?: string };

export default function SignInScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<Params>();
  const [email, setEmail] = useState('');
  const [emailCode, setEmailCode] = useState('');
  // false: asking for the email. true: the code was sent, asking for the code.
  const [codeSent, setCodeSent] = useState(false);
  // Set once the email code is accepted. If joining then fails (say the invite
  // was already used), pressing the button again retries only the join.
  const [verified, setVerified] = useState(false);
  const { busy, error, run, setError } = useAction();

  function sendCode() {
    return run(async () => {
      await sendEmailCode(email);
      setCodeSent(true);
    });
  }

  function verify() {
    return run(async () => {
      if (!verified) {
        await verifyEmailCode(email, emailCode);
        setVerified(true);
      }
      if (params.next === 'join' && params.code && params.name) {
        await redeemInvite(params.code, params.name);
        resetTo('/');
      } else if (params.next === 'create') {
        resetTo('/create-family');
      } else {
        resetTo('/');
      }
    });
  }

  function useDifferentEmail() {
    setCodeSent(false);
    setEmailCode('');
    setError(null);
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: t('signIn.title') }} />
      {codeSent ? (
        <>
          <Body>{t('signIn.codeSent', { email: email.trim() })}</Body>
          <TextField
            label={t('signIn.codeLabel')}
            value={emailCode}
            onChangeText={setEmailCode}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={6}
          />
          <ErrorMessage error={error} />
          <Button
            label={t('signIn.verify')}
            onPress={verify}
            busy={busy}
            disabled={emailCode.trim().length !== 6}
          />
          <Button label={t('signIn.resend')} onPress={sendCode} variant="secondary" />
          <Button label={t('signIn.changeEmail')} onPress={useDifferentEmail} variant="secondary" />
        </>
      ) : (
        <>
          <Body>{t('signIn.intro')}</Body>
          <TextField
            label={t('signIn.emailLabel')}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
          />
          <ErrorMessage error={error} />
          <Button
            label={t('signIn.sendCode')}
            onPress={sendCode}
            busy={busy}
            disabled={!email.includes('@')}
          />
        </>
      )}
    </Screen>
  );
}
