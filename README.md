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
