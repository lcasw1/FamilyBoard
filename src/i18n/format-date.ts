// Formats a date or time in the app's language and the device's time zone.
//
//   formatDate(new Date(), 'zh-CN', { weekday: 'long' })  -> '星期二'
//
// Use this instead of date.toLocaleString(language, ...). On Android, Hermes (the
// JavaScript engine) doesn't recognise 'zh-CN' and silently falls back to
// English; it does know 'zh-Hans-CN' (Chinese, simplified characters, China).
// That matters on Grandma's tablet, which shows the language the family chose.
const DATE_LOCALES: Record<string, string[]> = {
  // Intl uses the first one it supports.
  'zh-CN': ['zh-Hans-CN', 'zh-CN', 'zh'],
};

export function formatDate(
  date: Date,
  language: string,
  options: Intl.DateTimeFormatOptions,
): string {
  const locales = DATE_LOCALES[language] ?? [language];
  return new Intl.DateTimeFormat(locales, options).format(date);
}
