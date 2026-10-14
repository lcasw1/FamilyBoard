// A large day clock for Grandma: the day of the week, the part of the day, the
// date and the time, e.g.
//
//   Tuesday
//   Afternoon
//   October 13, 2026
//   3:15 PM
//
// It uses the tablet's own time zone, and the language the family chose for it.
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { formatDate } from '@/i18n/format-date';

import { colors, fontSizes, spacing } from './theme';

export type PartOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

/** 0–23 -> part of the day: 5–11 morning, 12–16 afternoon, 17–20 evening, else night. */
export function partOfDay(hour: number): PartOfDay {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

// Often enough that the minute changes on time (at most 10 seconds late).
const TICK_MS = 10 * 1000;

export function DayClock() {
  const { t, i18n } = useTranslation();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  // Formatted in the tablet's time zone, in the family's chosen language.
  const language = i18n.language;
  const weekday = formatDate(now, language, { weekday: 'long' });
  const date = formatDate(now, language, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const time = formatDate(now, language, { hour: 'numeric', minute: '2-digit' });

  return (
    <View style={styles.clock} accessibilityRole="header">
      <Text style={styles.weekday}>{weekday}</Text>
      <Text style={styles.partOfDay}>{t(`display.partOfDay.${partOfDay(now.getHours())}`)}</Text>
      <Text style={styles.line}>{date}</Text>
      <Text style={styles.line}>{time}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  clock: { alignItems: 'center', gap: spacing.small },
  weekday: {
    fontSize: fontSizes.clock,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  partOfDay: {
    fontSize: fontSizes.displayTitle,
    fontWeight: '600',
    color: colors.primary,
    textAlign: 'center',
  },
  line: { fontSize: fontSizes.display, color: colors.text, textAlign: 'center' },
});
