import { HttpErrorResponse, HttpEventType, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, tap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { HEALTH_URL, HealthService } from '../services/health.service';

/** Statuses a reverse proxy returns when the API behind it is not answering. */
const GATEWAY_STATUSES = new Set([502, 503, 504]);

/** Attaches Basic credentials to API calls, handles 401s and reports reachability. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const isHealthProbe = req.url.startsWith(HEALTH_URL);
  const health = isHealthProbe ? null : inject(HealthService);

  const header = auth.authorizationHeader();
  const authorized =
    header && req.url.startsWith('/api') && !req.headers.has('Authorization')
      ? req.clone({ setHeaders: { Authorization: header } })
      : req;

  return next(authorized).pipe(
    tap((event) => {
      if (event.type === HttpEventType.Response) {
        health?.reportReachable();
      }
    }),
    catchError((error: unknown) => {
      const isLoginAttempt = req.url.endsWith('/api/auth/login');

      if (error instanceof HttpErrorResponse) {
        if (error.status === 0) {
          health?.reportUnreachable();
        } else if (GATEWAY_STATUSES.has(error.status)) {
          void health?.check();
        } else {
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
