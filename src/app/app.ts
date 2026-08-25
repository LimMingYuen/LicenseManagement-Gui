import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { filter, map } from 'rxjs';
import { SidebarComponent } from './sidebar/sidebar';
import { ServerUnavailable } from './pages/server-unavailable/server-unavailable';
import { AuthService } from './services/auth.service';
import { HealthService } from './services/health.service';
import { safeReturnUrl } from './shared/utils/return-url';

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

  /**
   * The active URL, as a signal. Router.url is a plain getter, so reading it inside an
   * effect or a computed tracks nothing — the value is only ever as fresh as whatever else
   * triggered the re-run. Everything below needs to react to the route itself.
   */
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /**
   * The one route that must never render inside the signed-in shell. The shell picks its
   * branch from the auth state alone, which is normally enough — but the two can disagree
   * for as long as it takes a redirect to run, and a login form framed by the sidebar of
   * the session you are already in is the most confusing thing the app can show.
   */
  protected readonly isOnLoginPage = computed(
    () =>
      this.router.parseUrl(this.currentUrl()).root.children['primary']?.segments[0]?.path ===
      'login',
  );

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
    // one — and the URL stays there once the credentials come back. guestGuard turns away
    // any *navigation* to /login with a session in hand; this covers the other direction,
    // where the session arrives while the user is already sitting on the page and no
    // navigation is pending to run a guard.
    //
    // Both signals read here are reactive on purpose. An earlier version read Router.url
    // directly, so the effect only ever re-ran on the auth flip: at bootstrap that flip has
    // already happened by the time the component is built (the session is restored in an
    // app initializer, and the first change detection runs before the router's initial
    // navigation), the URL still read '/', and the redirect was never attempted again.
    effect(() => {
      if (!this.auth.isAuthenticated() || !this.isOnLoginPage()) {
        return;
      }

      // The guard and the interceptor both stash where the user was headed. Anything
      // pointing back at /login would only re-run this, so fall back to the dashboard.
      const returnUrl = this.router.parseUrl(this.currentUrl()).queryParams['returnUrl'];

      void this.router.navigateByUrl(safeReturnUrl(returnUrl));
    });
  }
}
