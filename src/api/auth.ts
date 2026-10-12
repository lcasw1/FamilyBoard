// Signing in and out. Family members sign in with a 6-digit code sent by email.
// Grandma's tablet signs in anonymously once, then joins with a display invite.
import { supabase } from './client';
import { ApiError, throwIfError, toApiError } from './errors';

/** Step 1 of email sign-in: email the user a 6-digit code. Creates the account if new. */
export async function sendEmailCode(email: string): Promise<void> {
  throwIfError(
    await supabase().auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    }),
  );
}

/** Step 2 of email sign-in: check the code the user typed. */
export async function verifyEmailCode(email: string, code: string): Promise<void> {
  const { error } = await supabase().auth.verifyOtp({
    email: email.trim(),
    token: code.replace(/\s/g, ''),
    type: 'email',
  });
  if (error) {
    const apiError = toApiError(error);
    // A wrong or expired code is the usual reason; keep network errors as they are.
    throw apiError.key === 'network' ? apiError : new ApiError('invalid_email_code', error);
  }
}

/** Signs in the display tablet without an email. Then call redeemInvite with a display code. */
export async function signInDisplayDevice(): Promise<void> {
  throwIfError(await supabase().auth.signInAnonymously());
}

export async function signOut(): Promise<void> {
  throwIfError(await supabase().auth.signOut());
}

/** The signed-in user's id, or null if nobody is signed in on this region. */
export async function getCurrentUserId(): Promise<string | null> {
  // getSession reads the saved session from the device, so it works offline.
  const { data } = await supabase().auth.getSession();
  return data.session?.user.id ?? null;
}

/**
 * Calls `onChange(userId)` whenever someone signs in or out. Returns a function
 * that stops listening; call it when the screen using this goes away.
 */
export function onUserChange(onChange: (userId: string | null) => void): () => void {
  const { data } = supabase().auth.onAuthStateChange((_event, session) => {
    onChange(session?.user.id ?? null);
  });
  return () => data.subscription.unsubscribe();
}
