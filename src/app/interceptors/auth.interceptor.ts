import { HttpErrorResponse, HttpEventType, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, tap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { HEALTH_URL, HealthService } from '../services/health.service';

/**
 * Attaches the Basic credentials to every API call, drops the session if the server ever
 * rejects them (password changed elsewhere, account deactivated), and folds the outcome of
 * each call into the connection state.
 *
 * That last part is what makes an outage visible immediately: the health poll would find it
 * within 30 seconds anyway, but a request that dies on a refused connection already knows.
 */
/** Statuses a reverse proxy returns when the API behind it is not answering. */
const GATEWAY_STATUSES = new Set([502, 503, 504]);

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // The probe must not report on itself — HealthService owns that state, and injecting it
  // here for its own request would re-enter the service mid-probe.
  const isHealthProbe = req.url.startsWith(HEALTH_URL);
  const health = isHealthProbe ? null : inject(HealthService);

  const header = auth.authorizationHeader();
  const authorized =
    header && req.url.startsWith('/api') && !req.headers.has('Authorization')
      ? req.clone({ setHeaders: { Authorization: header } })
      : req;

  return next(authorized).pipe(
    tap((event) => {
      // Any answer at all — including a 4xx — proves the API is there.
      if (event.type === HttpEventType.Response) {
        health?.reportReachable();
      }
    }),
    catchError((error: unknown) => {
      const isLoginAttempt = req.url.endsWith('/api/auth/login');

      if (error instanceof HttpErrorResponse) {
        if (error.status === 0) {
          // The transport gave up: refused, DNS, timeout, blocked preflight. Nothing
          // answered, so there is no server to have an opinion.
          health?.reportUnreachable();
        } else if (GATEWAY_STATUSES.has(error.status)) {
          // A proxy sits in front of the API in dev and in most deployments, and a dead
          // upstream reaches us as the proxy's 502/504 rather than a refused connection.
          // The status alone cannot tell that apart from the API itself being busy, so ask
          // the probe instead of guessing.
          void health?.check();
        } else {
          // Any other status was written by the API, which is therefore alive.
          health?.reportReachable();
        }

        if (error.status === 401 && !isLoginAttempt) {
          auth.logout();
          void router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
        }
      }

      return throwError(() => error);
    }),
  );
};
