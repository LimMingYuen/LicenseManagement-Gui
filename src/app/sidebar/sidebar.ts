import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatMenuModule } from '@angular/material/menu';

import { AuthService } from '../services/auth.service';
import { HealthService } from '../services/health.service';
import { PAGE_REGISTRY } from '../config/page-registry';
import { AppLogoComponent } from '../shared/components/app-logo/app-logo';

export interface NavItem {
  label: string;
  icon: string;
  route: string;
  /** Passed to routerLinkActiveOptions so prefix paths do not double-highlight. */
  exact: boolean;
}

/**
 * The app shell: a collapsible icon rail on the left, the routed page beside it.
 * Ported from PENTA SMC AMR so both products share one navigation model.
 *
 * Items come from PAGE_REGISTRY and are filtered by role, so a non-SuperAdmin never
 * sees a link the route guard would bounce them off.
 */
@Component({
  selector: 'app-sidebar',
  imports: [
    RouterModule,
    MatIconModule,
    MatButtonModule,
    MatSidenavModule,
    MatTooltipModule,
    MatDividerModule,
    MatMenuModule,
    AppLogoComponent,
  ],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent {
  protected readonly auth = inject(AuthService);
  protected readonly health = inject(HealthService);
  private readonly router = inject(Router);

  /**
   * The dot on the avatar used to be decorative — always green, whatever the server was
   * doing. It now tracks the API, so the always-visible corner of the shell tells the truth
   * even after the banner has been read and scrolled past.
   */
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

  protected readonly collapsed = signal(true);

  /** Navigation items the signed-in account is allowed to see. */
  protected readonly navItems = computed<NavItem[]>(() => {
    const isSuperAdmin = this.auth.isSuperAdmin();

    return PAGE_REGISTRY.filter((page) => !page.superAdminOnly || isSuperAdmin).map((page) => ({
      label: page.name,
      icon: page.icon,
      route: page.path,
      exact: page.exact ?? false,
    }));
  });

  protected readonly userName = computed(() => {
    const user = this.auth.currentUser();
    return user?.fullName || user?.username || 'User';
  });

  protected readonly userRole = computed(() => this.auth.currentUser()?.role ?? '');

  /** Two-letter avatar initials, from the full name when there is one. */
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

  protected toggleSidebar(): void {
    this.collapsed.update((value) => !value);
  }

  protected async logout(): Promise<void> {
    this.auth.logout();
    await this.router.navigateByUrl('/login');
  }
}
