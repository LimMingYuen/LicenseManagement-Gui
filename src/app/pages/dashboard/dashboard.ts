import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header';
import { LicenseDetailComponent } from '../../shared/components/license-detail/license-detail';
import { AuthService } from '../../services/auth.service';
import { LicenseService } from '../../services/license.service';
import { License, LicenseSummary } from '../../models/license.models';
import { describeError } from '../../shared/utils/http-error';
import { formatIsoDateTime } from '../../shared/utils/date-format';

/** Landing page: the state of the register at a glance, and the way into issuing. */
@Component({
  selector: 'app-dashboard',
  imports: [
    RouterLink,
    MatIconModule,
    MatSnackBarModule,
    PageHeaderComponent,
    LicenseDetailComponent,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {
  private readonly licenses = inject(LicenseService);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly auth = inject(AuthService);

  protected readonly summary = signal<LicenseSummary | null>(null);
  protected readonly loading = signal(true);
  protected readonly detail = signal<License | null>(null);

  protected readonly quickActions = [
    {
      route: '/licenses/machine',
      icon: 'precision_manufacturing',
      title: 'Machine license',
      description: "Bind a license to a customer's machine",
    },
    {
      route: '/licenses/robot',
      icon: 'smart_toy',
      title: 'Robot license',
      description: 'Bind a robot to its machine',
    },
    {
      route: '/licenses/gateway',
      icon: 'router',
      title: 'Gateway license',
      description: 'Bind an OMRON DI Gateway device',
    },
  ];

  constructor() {
    void this.load();
  }

  protected formatDate = formatIsoDateTime;

  protected async load(): Promise<void> {
    this.loading.set(true);

    try {
      this.summary.set(await this.licenses.summary());
    } catch (error) {
      this.notify(describeError(error, 'Could not load the dashboard.'), 'error');
    } finally {
      this.loading.set(false);
    }
  }

  /** How long a watchlist entry has left. "Due" covers today and anything already past. */
  protected expiryLabel(value: string | null): string {
    if (!value) return 'Perpetual';

    const days = Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000);
    return days <= 0 ? 'Due' : `${days}d left`;
  }

  protected typeTone(type: License['type']): string {
    return type === 'Machine' ? 'info' : type === 'Robot' ? 'success' : 'neutral';
  }

  protected statusTone(status: License['status']): string {
    switch (status) {
      case 'Active':
        return 'success';
      case 'Expiring':
        return 'warning';
      case 'Expired':
      case 'Revoked':
        return 'danger';
      default:
        return 'neutral';
    }
  }

  private notify(message: string, tone: 'success' | 'error'): void {
    this.snackBar.open(message, 'Close', {
      duration: tone === 'error' ? 6000 : 3000,
      panelClass: [`${tone}-snackbar`],
    });
  }
}
