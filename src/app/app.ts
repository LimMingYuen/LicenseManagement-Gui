import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { SidebarComponent } from './sidebar/sidebar';
import { ServerUnavailable } from './pages/server-unavailable/server-unavailable';
import { AuthService } from './services/auth.service';
import { HealthService } from './services/health.service';

@Component({
  imports: [RouterOutlet, MatSnackBarModule, SidebarComponent, ServerUnavailable],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly auth = inject(AuthService);
  protected readonly health = inject(HealthService);

  private readonly router = inject(Router);

  constructor() {
    // An outage at page load leaves the stored credentials unverified rather than rejected,
    // so the session is still there to pick up once the API answers. Without this the user
    // comes back from the server-unavailable screen to a login form, having done nothing
    // wrong. Settles after one pass: a verified session is no longer unverified, and a
    // rejected one no longer has credentials.
    effect(() => {
      if (!this.health.isDown() && this.auth.isSessionUnverified()) {
        void this.auth.restoreSession();
      }
    });

    // Restoring the session is only half the recovery. A page load during an outage also
    // sends the guard to /login — it cannot tell an unverified session from a signed-out
    // one — and /login has no guard to bounce off once the credentials come back. The
    // result is the login form rendered inside the signed-in shell. So the moment the user
    // is authenticated again, leave the stale redirect behind.
    effect(() => {
      if (!this.auth.isAuthenticated()) {
        return;
      }

      const url = this.router.parseUrl(this.router.url);
      if (url.root.children['primary']?.segments[0]?.path !== 'login') {
        return;
      }

      // The guard and the interceptor both stash where the user was headed. Anything
      // pointing back at /login would only re-run this, so fall back to the dashboard.
      const returnUrl = url.queryParams['returnUrl'];
      const target =
        typeof returnUrl === 'string' && returnUrl.startsWith('/') && !returnUrl.startsWith('/login')
          ? returnUrl
          : '/dashboard';

      void this.router.navigateByUrl(target);
    });
  }
}
