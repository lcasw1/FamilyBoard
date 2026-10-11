// Root layout: wraps every screen. Expo Router treats files in src/app/ as routes.
import '@/i18n';

import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function RootLayout() {
  const { t } = useTranslation();
  return <Stack screenOptions={{ title: t('app.name') }} />;
}
