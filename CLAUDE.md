# Family Board

A family message board for a grandmother with Alzheimer's. Family send photos, voice
messages and short notes from their phones; they appear on an always-on Android tablet
beside her that she never has to operate. Users: Grandma (display tablet), her husband,
her hired aide, and family in the US and China.

## Stack

- Expo (React Native, TypeScript, Expo Router). Android first; iOS later from the same code.
- Supabase: Postgres, Auth, Storage, Realtime. US region now; a self-hosted China
  instance later.
- i18n: i18next + react-i18next + expo-localization.
- Media: expo-image-picker (photos), expo-audio (record and play voice).
- Display: expo-keep-awake; the tablet uses Android screen pinning.

## Hard rules

- **No Google services or SDKs** (Firebase, FCM-only push, Google Sign-In, Google Maps).
  The app must keep working in mainland China, where Google is blocked.
- **All network calls live in `src/api/`.** Screens and components never import the
  Supabase client directly.
- **Region is data, not code.** Server URL and keys come from the family's region config
  in `src/api/region.ts`. On startup, follow a family's `moved_to` pointer if set.
  Never hard-code a server URL in a screen.
- **Every user-facing string is an i18n key.** Add it to both `src/i18n/en.json` and
  `src/i18n/zh-CN.json` in the same change. No literal UI text in components.
- **Times:** store UTC; display in the device's local time zone. The day clock uses the
  tablet's own time zone and language.
- **Display screens (Grandma's tablet):** no required taps except Play; body text at
  least 32sp; touch targets at least 64dp; high contrast; never autoplay audio; keep
  showing the last content when offline.
- **Privacy:** row-level security on every table; private storage bucket with
  short-lived signed URLs; never log message content, captions, photos or audio.

## Data model (MVP)

- `families`: id, name, region (`us` | `cn`), display_language, moved_to
- `members`: family_id, user_id, display_name, photo_path, role (`display` | `sender` | `aide` | `admin`)
- `messages`: family_id, sender_id, type (`photo` | `voice` | `text`), file_path, caption, created_at, hidden
- `invites`: family_id, code, role, expires_at

Schema changes go through Supabase migrations in `supabase/migrations/`, never ad hoc in
the dashboard.

## Commands

- `npx expo start` — dev server
- `npx expo run:android` — build and run on a connected device or emulator
- `eas build -p android --profile preview` — APK to install on the family devices
- `supabase migration new <name>` then `supabase db push` — schema changes

## Working with two developers

- The parent works on `main`. Lucas works on branches and opens pull requests.
- Lucas knows Python and is new to TypeScript and React. On his branches, prefer simple,
  readable, idiomatic code over clever code, and explain non-obvious choices.
