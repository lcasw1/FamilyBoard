// Colors and sizes shared by all screens. High contrast on purpose: many of our
// users are older, and Grandma's display needs to be readable from across a room.

export const colors = {
  background: '#FFFFFF',
  text: '#111111',
  textMuted: '#4A4A4A',
  primary: '#0B5CAD',
  primaryText: '#FFFFFF',
  border: '#8A8A8A',
  error: '#B00020',
  errorBackground: '#FDECEE',
  surface: '#F2F4F7',
} as const;

// Font sizes in sp (Android scales them with the user's font-size setting).
export const fontSizes = {
  body: 20,
  title: 28,
  large: 36,
  // CLAUDE.md: body text on the display tablet is at least 32sp.
  display: 40,
  displayTitle: 56,
} as const;

export const spacing = {
  small: 8,
  medium: 16,
  large: 24,
  xlarge: 40,
} as const;

// CLAUDE.md: touch targets at least 64dp.
export const minTouchSize = 64;
