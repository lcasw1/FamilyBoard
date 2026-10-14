-- Changing members' roles, and making sure a family always keeps an admin.
--
-- Roles can't be updated directly (see the column grants in the initial schema);
-- admins change them through set_member_role below. A trigger stops the last
-- admin from being removed or leaving, whichever way it is attempted.

-- Locks the family's row until the end of the transaction. Two admins demoting
-- each other at the same moment then run one after the other, so the second one
-- sees that only one admin is left and is refused.
create function public.lock_family(p_family_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  select null from public.families where id = p_family_id for update;
$$;

-- True if the family has an admin other than p_user_id.
create function public.has_other_admin(p_family_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.members
    where family_id = p_family_id and role = 'admin' and user_id <> p_user_id
  );
$$;

-- Admins only. Changes another member's role between sender, aide and admin.
-- The display role is for Grandma's tablet alone: a tablet can't be given another
-- role, and nobody can be made a display (a new tablet joins with a display invite).
create function public.set_member_role(p_family_id uuid, p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_role text;
begin
  if public.my_role(p_family_id) is distinct from 'admin' then
    raise exception 'not_allowed';
  end if;

  perform public.lock_family(p_family_id);

  select role into v_current_role from public.members
  where family_id = p_family_id and user_id = p_user_id;

  if not found then
    raise exception 'member_not_found';
  elsif v_current_role = 'display' or p_role not in ('sender', 'aide', 'admin') then
    raise exception 'role_change_not_allowed';
  elsif v_current_role = 'admin' and p_role <> 'admin'
    and not public.has_other_admin(p_family_id, p_user_id) then
    raise exception 'last_admin';
  end if;

  update public.members set role = p_role
  where family_id = p_family_id and user_id = p_user_id;
end;
$$;

-- Runs before any row is deleted from members (an admin removing someone, or
-- someone leaving). Refuses to remove the family's last admin.
create function public.protect_last_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- When a whole family is deleted, its members go with it; that's fine.
  if old.role = 'admin'
    and exists (select 1 from public.families where id = old.family_id) then
    perform public.lock_family(old.family_id);
    if not public.has_other_admin(old.family_id, old.user_id) then
      raise exception 'last_admin';
    end if;
  end if;
  return old;
end;
$$;

create trigger members_protect_last_admin
  before delete on public.members
  for each row execute function public.protect_last_admin();

-- Only signed-in users may call set_member_role. The helpers and the trigger
-- function are internal and callable by nobody directly.
revoke execute on function
  public.lock_family(uuid),
  public.has_other_admin(uuid, uuid),
  public.set_member_role(uuid, uuid, text),
  public.protect_last_admin()
from public, anon, authenticated;

grant execute on function public.set_member_role(uuid, uuid, text) to authenticated;
