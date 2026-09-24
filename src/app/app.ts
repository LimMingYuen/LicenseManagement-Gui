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

/** Root shell that shows the server-unavailable screen, the sidebar shell or the bare outlet. */
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

  /** The active URL as a signal, since Router.url is not reactive. */
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /** Whether the current route is the login page, which never renders inside the shell. */
  protected readonly isOnLoginPage = computed(
    () =>
      this.router.parseUrl(this.currentUrl()).root.children['primary']?.segments[0]?.path ===
      'login',
  );

  constructor() {
    effect(() => {
      if (!this.health.isDown() && this.auth.isSessionUnverified()) {
        void this.auth.restoreSession();
      }
    });

    effect(() => {
      if (!this.auth.isAuthenticated() || !this.isOnLoginPage()) {
        return;
      }

      const returnUrl = this.router.parseUrl(this.currentUrl()).queryParams['returnUrl'];

      void this.router.navigateByUrl(safeReturnUrl(returnUrl));
    });
  }
}
