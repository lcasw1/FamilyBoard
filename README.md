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

One-time setup on a Mac:

- Install Android Studio, and in its Device Manager create an emulator (or plug in an
  Android phone with USB debugging on).
- Install **JDK 17** (React Native's supported version), for example Eclipse Temurin 17
  into `~/Library/Java/JavaVirtualMachines/`. Android Studio's bundled Java 25 makes the
  native build fail with "A restricted method in java.lang.System has been called".
- Add to `~/.zshrc`:

  ```bash
  export JAVA_HOME="$(/usr/libexec/java_home -v 17)"
  export ANDROID_HOME="$HOME/Library/Android/sdk"
  export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
  ```

- In `.env.local`, the emulator reaches this Mac at `10.0.2.2`, not `127.0.0.1`:
  `EXPO_PUBLIC_SUPABASE_US_URL=http://10.0.2.2:54321`. A real phone on Wi-Fi needs the
  Mac's LAN address instead.

Then `npx expo run:android` builds the app and installs it (the first build takes about
10 minutes and several GB of disk). After that, `npx expo start` is enough until a
native package is added.

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

## Hosted Supabase setup (when we create the real project)

- Run the migrations: `npx supabase link` then `npx supabase db push`.
- Auth → Sign In / Providers: turn on **Anonymous sign-ins** (for the tablet).
- Auth → Email Templates: paste `supabase/templates/email-code.html` into both
  **Confirm signup** and **Magic Link**, so emails contain a 6-digit code.
Studio (a web UI for the local database) runs at http://127.0.0.1:54323.
