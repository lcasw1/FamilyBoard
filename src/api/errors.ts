// Turns errors from Supabase into an ApiError carrying an i18n key, so screens can
// show a translated message with t(error.i18nKey) instead of raw server text.

// The keys our database functions raise (see the migration), plus a few of our own.
// Each one needs a matching "errors.<key>" entry in both i18n files.
const KNOWN_ERRORS = [
  'not_allowed',
  'invalid_display_name',
  'invalid_expiry',
  'invite_not_found',
  'invite_used',
  'invite_expired',
  'invite_role_not_allowed',
  'already_member',
  'invalid_email_code',
  'region_unavailable',
  'network',
] as const;

export type ErrorKey = (typeof KNOWN_ERRORS)[number] | 'generic';

export class ApiError extends Error {
  readonly key: ErrorKey;

  constructor(key: ErrorKey, cause?: unknown) {
    super(key, { cause });
    this.name = 'ApiError';
    this.key = key;
  }

  /** The i18n key to show, e.g. 'errors.invite_expired'. */
  get i18nKey(): string {
    return `errors.${this.key}`;
  }
}

function isKnownError(message: string): message is (typeof KNOWN_ERRORS)[number] {
  return (KNOWN_ERRORS as readonly string[]).includes(message);
}

/**
 * Converts anything thrown by Supabase (or fetch) into an ApiError. Only short
 * error codes are kept, never the server's message text, so nothing a user wrote
 * can end up in an error report.
 */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  const message = (error as { message?: unknown } | null)?.message;
  if (typeof message === 'string') {
    if (isKnownError(message)) {
      return new ApiError(message, error);
    }
    // fetch failures read 'Network request failed' (React Native) or
    // 'fetch failed' / 'Failed to fetch' (Node and browsers).
    if (/network request failed|fetch failed|failed to fetch/i.test(message)) {
      return new ApiError('network', error);
    }
  }
  return new ApiError('generic', error);
}

// Supabase calls return either `{ data, error: null }` or `{ data: null, error }`
// instead of throwing (like Go, not Python). These helpers turn an error into an
// exception so callers can use try/catch.

/** Returns `data`, or throws an ApiError if there was an error or no data. */
export function unwrap<T>(result: { data: T | null; error: unknown }): T {
  if (result.error) {
    throw toApiError(result.error);
  }
  if (result.data === null) {
    throw new ApiError('generic');
  }
  return result.data;
}

/** For calls whose data we don't need: throws an ApiError if there was an error. */
export function throwIfError(result: { error: unknown }): void {
  if (result.error) {
    throw toApiError(result.error);
  }
}
