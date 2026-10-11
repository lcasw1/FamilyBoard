// Sets up translations. Import this file once, at the top of the root layout,
// before any screen calls useTranslation().
import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './en.json';
import zhCN from './zh-CN.json';

export const SUPPORTED_LANGUAGES = ['en', 'zh-CN'] as const;
// A TypeScript "union type": the value must be exactly 'en' or 'zh-CN'.
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

// Pick a supported language from the device settings. Any Chinese locale
// (zh-Hans-CN, zh-TW, ...) maps to zh-CN for now; everything else falls back to English.
export function deviceLanguage(): Language {
  const code = getLocales()[0]?.languageCode ?? 'en';
  return code === 'zh' ? 'zh-CN' : 'en';
}

// i18next's init is async, but with in-memory resources it is ready on the
// next line, so screens don't need to wait for it.
const i18n = createInstance();
i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    'zh-CN': { translation: zhCN },
  },
  lng: deviceLanguage(),
  fallbackLng: 'en',
  // React already escapes text, so i18next doesn't need to.
  interpolation: { escapeValue: false },
});

export default i18n;
