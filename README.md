# Family Board

A message board for Grandma's tablet. See [CLAUDE.md](CLAUDE.md) for the project rules.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the Supabase URL and anon key
npx expo start               # press "a" for Android
```

Checks to run before opening a pull request:

```bash
npm run typecheck
npm run lint
npm test                  # unit tests, no server needed
npm run test:integration  # src/api/ against the local database (needs npm run db:start)
npm run db:test           # database security tests
```

## Running on Android

The app is built on Expo's servers (EAS), so this Mac doesn't need Java or a local
Android build. It only needs a device to run the app on.

One-time setup on a Mac:

- Install Android Studio, and in its Device Manager create an emulator (or plug in an
  Android phone with USB debugging on).
- Add to `~/.zshrc`:

  ```bash
  export ANDROID_HOME="$HOME/Library/Android/sdk"
  export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
  ```

- In `.env.local`, the emulator reaches this Mac at `10.0.2.2`, not `127.0.0.1`:
  `EXPO_PUBLIC_SUPABASE_US_URL=http://10.0.2.2:54321`. A real phone on Wi-Fi needs the
  Mac's LAN address instead.

### Development build

The development build is the app without your code in it: it loads the code from the
dev server (`npx expo start`), so changes show up as soon as you save. Build it once:

```bash
npx eas-cli build -p android --profile development
```

When it finishes (10–30 minutes, depending on Expo's queue), open the link it prints
on the device, or download the APK and run `adb install <file>.apk` for the emulator.
Then day to day:

```bash
npx expo start            # press "a" to open the app on the emulator
```

Build it again only after adding a package with native code (`npx expo install` says
so in its output) or changing `app.json`, for example a new permission. The free Expo
plan has a monthly build limit, so don't rebuild for ordinary code changes.

### APK for the family devices

```bash
npx eas-cli build -p android --profile preview
```

This builds a standalone APK with the code inside it, pointing at the hosted server
(see `eas.json`). It needs no dev server.

### Building locally (optional)

`npx expo run:android` builds on this Mac instead. It needs JDK 17 (not Android
Studio's bundled Java 25, which fails with "A restricted method in java.lang.System has
been called"), about 10 GB of disk, and a lot of memory. The generated `android/`
folder is not kept in git; after changing packages or `app.json`, regenerate it with
`npx expo prebuild -p android --no-install` first.

## Local database

Needs Docker Desktop running. The Supabase CLI is a dev dependency, so use `npx supabase`.

```bash
npm run db:start   # start Postgres, Auth, Storage and Realtime in Docker
npm run db:test    # run the security tests in supabase/tests/
npm run db:reset   # wipe the local database and re-apply all migrations
npm run db:stop
```

Schema changes: `npx supabase migration new <name>`, edit the new file in
`supabase/migrations/`, then `npm run db:reset && npm run db:test`, then
`npm run db:types` to regenerate `src/api/database.types.ts`.

Sign-in emails don't really go out locally: open Mailpit at http://127.0.0.1:54324
to read them.

## Talking to the server

Everything that touches the network is in `src/api/` (ESLint blocks Supabase imports
anywhere else):

| File | What it does |
|---|---|
| `region.ts` | Which server to use; invite code parsing (`US7K3QXM` → `us`) |
| `client.ts` | Creates the Supabase client for the current region |
| `auth.ts` | Email code sign-in, tablet sign-in, sign out |
| `families.ts` | Families, members, invites |
| `messages.ts` | Send, list, hide, delete messages; real-time updates |
| `media.ts` | Upload photos and voice files; download them for offline use |
| `errors.ts` | Turns server errors into i18n keys (`errors.invite_expired`) |

Functions throw an `ApiError`; show it with `t(error.i18nKey)`.

## Hosted Supabase

The real project is `dipesvdlmhqgoecewgho` (region ca-central-1), at
https://dipesvdlmhqgoecewgho.supabase.co. Log in once with `npx supabase login`, then
`npx supabase link --project-ref dipesvdlmhqgoecewgho` (no database password needed).

- **Schema changes:** `npx supabase db push --dry-run` to preview, then `npx supabase db push`.
- **Auth settings** come from `supabase/config.toml`: `npx supabase config diff` to preview,
  then `npx supabase config push`. Answer **y** for auth and **n** for storage (the storage
  and pooler values in the file are local defaults).
- **Email:** sign-in codes are sent through Resend (resend.com) from
  `noreply@mail.we-familyboard.com`; the SMTP details are in the dashboard (Auth → Emails →
  SMTP Settings), not in this repo. The domain is registered at Namecheap, with Resend's DNS
  records (DKIM, SPF, DMARC). Supabase's own mailer can't be used: it only sends to the
  project's team, and on the free plan its template can't be changed to show the 6-digit code.
- **APK builds** read the server URL and publishable key from `eas.json` (both are public).

Studio (a web UI for the local database) runs at http://127.0.0.1:54323.
