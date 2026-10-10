import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AuthService } from '../../services/auth.service';
import { PAGE_REGISTRY } from '../../config/page-registry';
import { AppLogoComponent } from '../../shared/components/app-logo/app-logo';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header';

export interface NavItem {
  label: string;
  icon: string;
  route: string;
  /** Exact route matching, so prefix paths do not highlight together. */
  exact: boolean;
}

/** Renders the app shell: a collapsible navigation rail beside the shared header and routed page. */
@Component({
  selector: 'app-sidebar',
  imports: [
    RouterModule,
    MatIconModule,
    MatButtonModule,
    MatSidenavModule,
    MatTooltipModule,
    AppLogoComponent,
    PageHeaderComponent,
  ],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent {
  private readonly auth = inject(AuthService);

  protected readonly collapsed = signal(true);

  /** Navigation items the signed-in account is allowed to see. */
  protected readonly navItems = computed<NavItem[]>(() => {
    return PAGE_REGISTRY.filter((page) => this.auth.canAccessPage(page.path)).map((page) => ({
      label: page.name,
      icon: page.icon,
      route: page.path,
      exact: page.exact ?? false,
    }));
  });

  /** Expands or collapses the navigation rail. */
  protected toggleSidebar(): void {
    this.collapsed.update((value) => !value);
  }
}
