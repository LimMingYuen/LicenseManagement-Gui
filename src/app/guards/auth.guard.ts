import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Requires a signed-in user; sends everyone else to the login page. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }

  return true;
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
