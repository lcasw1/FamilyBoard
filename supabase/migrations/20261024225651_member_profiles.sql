-- Names and profile photos. Everyone can already edit their own display_name and
-- photo_path (see the initial schema). Admins can now edit them for anyone in
-- their family too, e.g. for a relative who isn't comfortable with apps.
--
-- Only those two columns can be updated (the column grants in the initial
-- schema), so this doesn't let admins change anything else, such as roles.

create policy "admins edit member profiles" on public.members
  for update to authenticated
  using (public.my_role(family_id) = 'admin');
