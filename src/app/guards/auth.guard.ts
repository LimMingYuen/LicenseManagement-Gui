import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { safeReturnUrl } from '../shared/utils/return-url';

/** Requires a signed-in user; sends everyone else to the login page. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }

  return true;
};

/**
 * The mirror image: keeps a signed-in user off the login page.
 *
 * A reload during an outage parks the browser on /login — the guard above cannot tell an
 * unverified session from a signed-out one — and the URL stays there after the API comes
 * back. Without this guard nothing stops that route from activating on the next load, and
 * because the shell renders by auth state alone the login form paints inside the signed-in
 * chrome, sidebar and all. It is also the plain answer to typing /login by hand mid-session.
 */
export const guestGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return true;
  }

  return router.parseUrl(safeReturnUrl(route.queryParamMap.get('returnUrl')));
};

/** Requires the SuperAdmin role. The API enforces this too — this only keeps the UI honest. */
export const superAdminGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const signedIn = authGuard(route, state);
  if (signedIn !== true) {
    return signedIn;
  }

  return auth.isSuperAdmin() ? true : router.createUrlTree(['/dashboard']);
};
