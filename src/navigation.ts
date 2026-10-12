import { router, type Href } from 'expo-router';

/**
 * Go to `href` and forget every screen before it, so the Back button can't return
 * to sign-in or setup screens. Use at the end of onboarding and after signing out.
 */
export function resetTo(href: Href): void {
  if (router.canDismiss()) {
    router.dismissAll();
  }
  router.replace(href);
}
