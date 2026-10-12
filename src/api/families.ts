// Families, members and invites.
import { getCurrentRegion, supabase, switchRegion } from './client';
import type { Tables } from './database.types';
import { ApiError, throwIfError, unwrap } from './errors';
import {
  defaultRegion,
  isRegion,
  isRegionAvailable,
  regionFromInviteCode,
  type Region,
} from './region';

export type Role = 'display' | 'sender' | 'aide' | 'admin';
export type DisplayLanguage = 'en' | 'zh-CN';

// Row types generated from the database. Field names match the columns (snake_case).
export type Family = Tables<'families'>;
export type Member = Tables<'members'>;
export type Invite = Tables<'invites'>;

/** A family the signed-in user belongs to, with their role in it. */
export type Membership = {
  family: Family;
  role: Role;
  displayName: string;
};

/** Creates a family on the current region's server; the caller becomes its admin. */
export async function createFamily(options: {
  name: string;
  displayLanguage: DisplayLanguage;
  adminDisplayName: string;
}): Promise<string> {
  const region = getCurrentRegion();
  if (!region) {
    throw new ApiError('region_unavailable');
  }
  return unwrap(
    await supabase().rpc('create_family', {
      p_name: options.name,
      p_region: region,
      p_display_language: options.displayLanguage,
      p_admin_display_name: options.adminDisplayName,
    }),
  );
}

/**
 * Switches to the server named by an invite code's prefix. Call this before the
 * user signs in, so they sign in on the right server.
 */
export async function switchRegionForInvite(code: string): Promise<Region> {
  const region = regionFromInviteCode(code);
  if (!region) {
    throw new ApiError('invite_not_found');
  }
  if (!isRegionAvailable(region)) {
    throw new ApiError('region_unavailable');
  }
  await switchRegion(region);
  return region;
}

/** Switches to the server for a brand-new family. Call before signing in. */
export async function switchRegionForNewFamily(): Promise<Region> {
  const region = defaultRegion();
  if (!region) {
    throw new ApiError('region_unavailable');
  }
  await switchRegion(region);
  return region;
}

/** Joins the signed-in user to the invite's family. Returns the family id. */
export async function redeemInvite(code: string, displayName: string): Promise<string> {
  return unwrap(
    await supabase().rpc('redeem_invite', { p_code: code, p_display_name: displayName }),
  );
}

/** Admins only. Returns the new invite code, e.g. 'US7K3QXM'. */
export async function createInvite(
  familyId: string,
  role: Role,
  validForDays = 7,
): Promise<string> {
  return unwrap(
    await supabase().rpc('create_invite', {
      p_family_id: familyId,
      p_role: role,
      // Postgres reads '7 days' as an interval.
      p_valid_for: `${validForDays} days`,
    }),
  );
}

/** Admins only. Invites that are still waiting to be used, newest first. */
export async function listOpenInvites(familyId: string): Promise<Invite[]> {
  return unwrap(
    await supabase()
      .from('invites')
      .select('*')
      .eq('family_id', familyId)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false }),
  );
}

export async function revokeInvite(inviteId: string): Promise<void> {
  throwIfError(await supabase().from('invites').delete().eq('id', inviteId));
}

/** The families the signed-in user belongs to. */
export async function listMyFamilies(): Promise<Membership[]> {
  const userId = (await supabase().auth.getSession()).data.session?.user.id;
  if (!userId) {
    return [];
  }
  // `families(*)` asks Supabase to join the families table into each row.
  const rows = unwrap(
    await supabase()
      .from('members')
      .select('role, display_name, families(*)')
      .eq('user_id', userId)
      .order('created_at'),
  );
  return rows.map((row) => ({
    family: row.families,
    role: row.role as Role,
    displayName: row.display_name,
  }));
}

export async function listMembers(familyId: string): Promise<Member[]> {
  return unwrap(
    await supabase().from('members').select('*').eq('family_id', familyId).order('created_at'),
  );
}

/** Changes the signed-in user's name in one family. */
export async function updateMyDisplayName(familyId: string, displayName: string): Promise<void> {
  const userId = (await supabase().auth.getSession()).data.session?.user.id;
  throwIfError(
    await supabase()
      .from('members')
      .update({ display_name: displayName.trim() })
      .eq('family_id', familyId)
      .eq('user_id', userId ?? ''),
  );
}

/**
 * If the family has moved to another region's server, returns that region.
 * The app then switches region and the user signs in again on the new server.
 */
export function movedToRegion(family: Family): Region | null {
  return isRegion(family.moved_to) ? family.moved_to : null;
}
