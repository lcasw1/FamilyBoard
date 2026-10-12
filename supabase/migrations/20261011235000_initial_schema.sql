-- Family Board: initial schema.
--
-- Security model in one paragraph: every table has row-level security (RLS), so
-- Postgres itself checks each row against the signed-in user. A user can only see
-- families they are a member of. Rows in `members` and `invites` are never inserted
-- directly by the app; the functions at the bottom (create_family, create_invite,
-- redeem_invite) do it after checking the rules. Column-level grants stop users from
-- editing columns they shouldn't (for example their own role).
--
-- Grandma's tablet signs in anonymously (it has no email) and may only join a family
-- through a `display` invite.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 100),
  region text not null check (region in ('us', 'cn')),
  display_language text not null default 'en' check (display_language in ('en', 'zh-CN')),
  -- Set when the family has moved to another region's server. Clients that find a
  -- value here switch to that region's server (see src/api/region.ts).
  moved_to text check (moved_to in ('us', 'cn') and moved_to <> region),
  created_at timestamptz not null default now()
);

create table public.members (
  family_id uuid not null references public.families (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 50),
  -- Path inside the private `media` bucket, e.g. '<family_id>/<file>.jpg'.
  photo_path text check (photo_path like family_id::text || '/%'),
  role text not null check (role in ('display', 'sender', 'aide', 'admin')),
  created_at timestamptz not null default now(),
  primary key (family_id, user_id)
);

create index members_user_id_idx on public.members (user_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  -- Filled in by the database from the signed-in user; the app cannot set it.
  sender_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type text not null check (type in ('photo', 'voice', 'text')),
  file_path text check (file_path like family_id::text || '/%'),
  caption text check (char_length(caption) <= 500),
  -- timestamptz is stored in UTC; the app converts to local time for display.
  created_at timestamptz not null default now(),
  hidden boolean not null default false,
  -- A text message needs words and no file; photo and voice messages need a file.
  constraint messages_content_check check (
    (type = 'text' and file_path is null and char_length(trim(caption)) > 0)
    or (type in ('photo', 'voice') and file_path is not null)
  )
);

create index messages_family_created_idx on public.messages (family_id, created_at desc);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  -- Stored without separators, e.g. 'US7K3QXM'. The first two letters are the
  -- region, so a new phone knows which server to ask before anyone signs in.
  code text not null unique,
  role text not null check (role in ('display', 'sender', 'aide', 'admin')),
  expires_at timestamptz not null,
  created_by uuid not null references auth.users (id) on delete cascade,
  -- Each invite works once. Set by redeem_invite.
  used_by uuid references auth.users (id) on delete set null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helper functions used by the policies
-- ---------------------------------------------------------------------------

-- The signed-in user's role in a family, or null if they are not a member.
-- `security definer` lets it read `members` without triggering the members
-- policies again (which would loop forever).
create function public.my_role(p_family_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.members
  where family_id = p_family_id and user_id = (select auth.uid());
$$;

-- True when the current session is an anonymous sign-in (the display tablet).
create function public.is_anonymous()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false);
$$;

-- Storage paths start with the family id: '<family_id>/<file>'. Returns null for
-- anything else, so policies fail closed instead of raising an error.
create function public.family_id_from_path(p_path text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return split_part(p_path, '/', 1)::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.families enable row level security;
alter table public.members enable row level security;
alter table public.messages enable row level security;
alter table public.invites enable row level security;

-- Supabase grants everything to `anon` and `authenticated` by default. Start from
-- nothing and grant only what the app needs. Signed-out users (`anon`) get nothing.
revoke all on public.families, public.members, public.messages, public.invites
  from anon, authenticated;

-- families: members can read; admins can rename and change the display language.
-- region and moved_to are changed by the server operator, not from the app.
grant select on public.families to authenticated;
grant update (name, display_language) on public.families to authenticated;

create policy "members read their families" on public.families
  for select to authenticated
  using (public.my_role(id) is not null);

create policy "admins update their families" on public.families
  for update to authenticated
  using (public.my_role(id) = 'admin');

-- members: see everyone in your families; edit your own name and photo; admins can
-- remove members and anyone can leave. Roles change only through functions.
grant select, delete on public.members to authenticated;
grant update (display_name, photo_path) on public.members to authenticated;

create policy "members read fellow members" on public.members
  for select to authenticated
  using (public.my_role(family_id) is not null);

create policy "members edit their own profile" on public.members
  for update to authenticated
  using (user_id = (select auth.uid()));

create policy "admins remove members, anyone can leave" on public.members
  for delete to authenticated
  using (user_id = (select auth.uid()) or public.my_role(family_id) = 'admin');

-- messages: everyone in the family reads them; admins and aides also see hidden
-- ones. Everyone except the display tablet can send. Only admins and aides can
-- hide, and only the `hidden` column can be updated.
grant select, delete on public.messages to authenticated;
grant insert (family_id, type, file_path, caption) on public.messages to authenticated;
grant update (hidden) on public.messages to authenticated;

create policy "members read visible messages" on public.messages
  for select to authenticated
  using (
    public.my_role(family_id) in ('admin', 'aide')
    or (not hidden and public.my_role(family_id) is not null)
  );

create policy "senders post messages" on public.messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.my_role(family_id) in ('sender', 'aide', 'admin')
  );

create policy "admins and aides hide messages" on public.messages
  for update to authenticated
  using (public.my_role(family_id) in ('admin', 'aide'));

create policy "senders delete own messages, admins any" on public.messages
  for delete to authenticated
  using (sender_id = (select auth.uid()) or public.my_role(family_id) = 'admin');

-- invites: admins can list and revoke them. They are created by create_invite.
grant select, delete on public.invites to authenticated;

create policy "admins read invites" on public.invites
  for select to authenticated
  using (public.my_role(family_id) = 'admin');

create policy "admins revoke invites" on public.invites
  for delete to authenticated
  using (public.my_role(family_id) = 'admin');

-- ---------------------------------------------------------------------------
-- Functions the app calls (via supabase.rpc). Each raises an exception whose
-- message is a short key such as 'invite_expired'; the app maps it to an i18n string.
-- ---------------------------------------------------------------------------

-- Creates a family and makes the caller its first admin. Returns the family id.
-- The app passes the region of the server it is talking to.
create function public.create_family(
  p_name text,
  p_region text,
  p_display_language text,
  p_admin_display_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_family_id uuid;
begin
  if (select auth.uid()) is null or public.is_anonymous() then
    raise exception 'not_allowed';
  end if;

  insert into public.families (name, region, display_language)
  values (trim(p_name), p_region, p_display_language)
  returning id into v_family_id;

  insert into public.members (family_id, user_id, display_name, role)
  values (v_family_id, (select auth.uid()), trim(p_admin_display_name), 'admin');

  return v_family_id;
end;
$$;

-- Creates a single-use invite and returns its code, e.g. 'US7K3QXM'. Admins only.
create function public.create_invite(
  p_family_id uuid,
  p_role text,
  p_valid_for interval default interval '7 days'
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- No 0/O, 1/I/L: easy to read aloud over the phone and to type.
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_prefix text;
  v_code text;
  v_bytes bytea;
begin
  if public.my_role(p_family_id) is distinct from 'admin' then
    raise exception 'not_allowed';
  end if;
  if p_valid_for <= interval '0' or p_valid_for > interval '30 days' then
    raise exception 'invalid_expiry';
  end if;

  select upper(region) into v_prefix from public.families where id = p_family_id;

  -- Try random codes until one is not already taken (almost always the first).
  loop
    v_bytes := extensions.gen_random_bytes(6);
    v_code := v_prefix;
    for i in 0..5 loop
      v_code := v_code || substr(v_alphabet, get_byte(v_bytes, i) % length(v_alphabet) + 1, 1);
    end loop;

    begin
      insert into public.invites (family_id, code, role, expires_at, created_by)
      values (p_family_id, v_code, p_role, now() + p_valid_for, (select auth.uid()));
      exit;  -- inserted, leave the loop
    exception when unique_violation then
      -- Code already exists; loop and try another.
    end;
  end loop;

  return v_code;
end;
$$;

-- Joins the caller to a family using an invite code. Returns the family id.
-- Accepts codes typed with spaces, dashes or lower case ('us-7k3q xm').
create function public.redeem_invite(p_code text, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.invites;
begin
  if (select auth.uid()) is null then
    raise exception 'not_allowed';
  end if;
  if char_length(trim(coalesce(p_display_name, ''))) not between 1 and 50 then
    raise exception 'invalid_display_name';
  end if;

  -- `for update` locks the row so two phones can't redeem the same code at once.
  select * into v_invite from public.invites
  where code = upper(regexp_replace(p_code, '[^A-Za-z0-9]', '', 'g'))
  for update;

  if not found then
    raise exception 'invite_not_found';
  elsif v_invite.used_at is not null then
    raise exception 'invite_used';
  elsif v_invite.expires_at < now() then
    raise exception 'invite_expired';
  elsif public.is_anonymous() and v_invite.role <> 'display' then
    -- An anonymous session (the tablet) may only become a display.
    raise exception 'invite_role_not_allowed';
  end if;

  begin
    insert into public.members (family_id, user_id, display_name, role)
    values (v_invite.family_id, (select auth.uid()), trim(p_display_name), v_invite.role);
  exception when unique_violation then
    raise exception 'already_member';
  end;

  update public.invites
  set used_by = (select auth.uid()), used_at = now()
  where id = v_invite.id;

  return v_invite.family_id;
end;
$$;

-- Functions are executable by everyone by default. Lock them to signed-in users.
revoke execute on function
  public.my_role(uuid),
  public.is_anonymous(),
  public.family_id_from_path(text),
  public.create_family(text, text, text, text),
  public.create_invite(uuid, text, interval),
  public.redeem_invite(text, text)
from public, anon;

grant execute on function
  public.my_role(uuid),
  public.is_anonymous(),
  public.family_id_from_path(text),
  public.create_family(text, text, text, text),
  public.create_invite(uuid, text, interval),
  public.redeem_invite(text, text)
to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: one private bucket. Files live under '<family_id>/...'. The app shows
-- them through short-lived signed URLs; nothing is public.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media',
  'media',
  false,
  20 * 1024 * 1024,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic',
    'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/aac', 'audio/mpeg', 'audio/webm'
  ]
);

create policy "members read family media" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'media'
    and public.my_role(public.family_id_from_path(name)) is not null
  );

create policy "members upload family media" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'media'
    and public.my_role(public.family_id_from_path(name)) in ('sender', 'aide', 'admin')
  );

create policy "uploaders and admins delete media" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'media'
    and (
      owner_id = (select auth.uid())::text
      or public.my_role(public.family_id_from_path(name)) = 'admin'
    )
  );

-- ---------------------------------------------------------------------------
-- Realtime: tell subscribed clients when messages change. Realtime applies the
-- same RLS policies, so each client only hears about its own family. A message
-- that becomes hidden simply stops being visible, so the tablet also refreshes
-- the list on a timer instead of relying on events alone.
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.messages;
