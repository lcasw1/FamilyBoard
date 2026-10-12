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
`supabase/migrations/`, then `npm run db:reset && npm run db:test`.
Studio (a web UI for the local database) runs at http://127.0.0.1:54323.
