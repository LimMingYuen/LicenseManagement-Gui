import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NgTemplateOutlet } from '@angular/common';
import { ActivatedRouteSnapshot, NavigationEnd, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { filter, map } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { HealthService } from '../../../services/health.service';
import { PageHeaderSlot } from './page-header-actions';

/** Route data the shell header reads its title and icon from. */
export interface PageHeading {
  heading: string;
  icon: string;
}

/** Shell header above every page: route title, the page's controls and the account menu. */
@Component({
  selector: 'app-page-header',
  imports: [
    NgTemplateOutlet,
    RouterLink,
    MatIconModule,
    MatDividerModule,
    MatMenuModule,
    MatTooltipModule,
  ],
  templateUrl: './page-header.html',
  styleUrl: './page-header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageHeaderComponent {
  protected readonly auth = inject(AuthService);
  protected readonly health = inject(HealthService);
  protected readonly slot = inject(PageHeaderSlot);
  private readonly router = inject(Router);

  /** Heading data of the deepest active route. */
  protected readonly page = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.activeHeading()),
    ),
    { initialValue: this.activeHeading() },
  );

  /** Text describing the current API connection state. */
  protected readonly connectionLabel = computed(() => {
    switch (this.health.status()) {
      case 'online':
        return 'Connected';
      case 'degraded':
        return 'Server degraded';
      case 'unhealthy':
        return 'Server fault';
      case 'unreachable':
        return 'Server unreachable';
      default:
        return 'Checking connection…';
    }
  });

  protected readonly userName = computed(() => {
    const user = this.auth.currentUser();
    return user?.fullName || user?.username || 'User';
  });

  protected readonly userRole = computed(() => this.auth.currentUser()?.role ?? '');

  /** Two-letter avatar initials, taken from the full name when present. */
  protected readonly initials = computed(() => {
    const user = this.auth.currentUser();
    const source = user?.fullName?.trim() || user?.username?.trim();
    if (!source) {
      return 'U';
    }

    const parts = source.split(/\s+/);
    const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : source.slice(0, 2);
    return letters.toUpperCase();
  });

  /** Signs out and navigates to the login page. */
  protected async logout(): Promise<void> {
    this.auth.logout();
    await this.router.navigateByUrl('/login');
  }

  private activeHeading(): Partial<PageHeading> {
    let route: ActivatedRouteSnapshot = this.router.routerState.snapshot.root;
    while (route.firstChild) {
      route = route.firstChild;
    }
    return route.data as Partial<PageHeading>;
  }
}
