// Small building blocks used by every screen, so they all look the same and meet
// the size rules in CLAUDE.md (64dp touch targets, large text).
//
// React components are functions that take "props" (like keyword arguments) and
// return what to draw. `children` is whatever is nested inside the component's tag.
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import type { ApiError } from '@/api/errors';

import { colors, fontSizes, minTouchSize, spacing } from './theme';

/** A scrollable page with padding that moves out of the way of the keyboard. */
export function Screen({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return (
    <Text style={styles.title} accessibilityRole="header">
      {children}
    </Text>
  );
}

export function Body({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  return <Text style={[styles.body, muted && styles.muted]}>{children}</Text>;
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  busy?: boolean;
  disabled?: boolean;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  busy = false,
  disabled = false,
}: ButtonProps) {
  const primary = variant === 'primary';
  const inactive = busy || disabled;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy }}
      // `style` can be a function of the pressed state: dim the button while pressed.
      style={({ pressed }) => [
        styles.button,
        primary ? styles.buttonPrimary : styles.buttonSecondary,
        (pressed || inactive) && styles.buttonDimmed,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={primary ? colors.primaryText : colors.primary} />
      ) : (
        <Text style={[styles.buttonLabel, primary ? styles.labelPrimary : styles.labelSecondary]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

type TextFieldProps = TextInputProps & { label: string };

/** A labelled text box. Extra props (value, onChangeText, keyboardType...) go to TextInput. */
export function TextField({ label, style, ...inputProps }: TextFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, style]}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={label}
        {...inputProps}
      />
    </View>
  );
}

/** Shows a translated error message, or nothing when `error` is null. */
export function ErrorMessage({ error }: { error: ApiError | null }) {
  const { t } = useTranslation();
  if (!error) {
    return null;
  }
  return (
    <Text style={styles.error} accessibilityRole="alert">
      {t(error.i18nKey)}
    </Text>
  );
}

/** Vertical space between groups of content. */
export function Gap() {
  return <View style={styles.gap} />;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  fill: { flex: 1 },
  screen: { padding: spacing.large, gap: spacing.medium },
  title: { fontSize: fontSizes.title, fontWeight: '700', color: colors.text },
  body: { fontSize: fontSizes.body, lineHeight: fontSizes.body * 1.4, color: colors.text },
  muted: { color: colors.textMuted },
  button: {
    minHeight: minTouchSize,
    borderRadius: 12,
    paddingHorizontal: spacing.large,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonSecondary: { borderWidth: 2, borderColor: colors.primary },
  buttonDimmed: { opacity: 0.6 },
  buttonLabel: { fontSize: fontSizes.body, fontWeight: '600', textAlign: 'center' },
  labelPrimary: { color: colors.primaryText },
  labelSecondary: { color: colors.primary },
  field: { gap: spacing.small },
  fieldLabel: { fontSize: fontSizes.body, fontWeight: '600', color: colors.text },
  input: {
    minHeight: minTouchSize,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.medium,
    fontSize: fontSizes.body,
    color: colors.text,
  },
  error: {
    fontSize: fontSizes.body,
    color: colors.error,
    backgroundColor: colors.errorBackground,
    padding: spacing.medium,
    borderRadius: 12,
  },
  gap: { height: spacing.medium },
});
