import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { safeReturnUrl } from '../shared/utils/return-url';

/** Allows signed-in users and redirects everyone else to the login page. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }

  return true;
};

/** Redirects signed-in users away from the login page to their return URL. */
export const guestGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return true;
  }

  return router.parseUrl(safeReturnUrl(route.queryParamMap.get('returnUrl')));
};

/** Allows only signed-in SuperAdmin users and redirects others to the dashboard. */
export const superAdminGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const signedIn = authGuard(route, state);
  if (signedIn !== true) {
    return signedIn;
  }

  return auth.isSuperAdmin() ? true : router.createUrlTree(['/dashboard']);
};
