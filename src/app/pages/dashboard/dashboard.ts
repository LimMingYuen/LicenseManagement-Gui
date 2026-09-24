import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header';
import {
  LicenseDetailComponent,
  LicenseDetailData,
} from '../../shared/components/license-detail/license-detail';
import { AuthService } from '../../services/auth.service';
import { LicenseService } from '../../services/license.service';
import { License, LicenseSummary } from '../../models/license.models';
import { dialogConfig } from '../../shared/utils/dialog';
import { describeError } from '../../shared/utils/http-error';
import { formatIsoDateTime } from '../../shared/utils/date-format';

/** Landing page with license stats, the expiry watchlist and quick actions. */
@Component({
  selector: 'app-dashboard',
  imports: [
    RouterLink,
    MatIconModule,
    MatButtonModule,
    MatSnackBarModule,
    PageHeaderComponent,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {
  private readonly licenses = inject(LicenseService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  protected readonly auth = inject(AuthService);

  protected readonly summary = signal<LicenseSummary | null>(null);
  protected readonly loading = signal(true);

  /** Opens the read-only license detail dialog. */
  protected openDetail(license: License): void {
    this.dialog.open(
      LicenseDetailComponent,
      dialogConfig<LicenseDetailData>({ license }, 'min(44rem, 96vw)'),
    );
  }

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

  /** Loads the license summary. */
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

  /** Formats the time left before a watchlist entry expires. */
  protected expiryLabel(value: string | null): string {
    if (!value) return 'Perpetual';

    const days = Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000);
    return days <= 0 ? 'Due' : `${days}d left`;
  }

  /** Maps a license type to its pill tone. */
  protected typeTone(type: License['type']): string {
    return type === 'Machine' ? 'info' : type === 'Robot' ? 'success' : 'neutral';
  }

  /** Maps a license status to its pill tone. */
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

  /** Shows a success or error snackbar. */
  private notify(message: string, tone: 'success' | 'error'): void {
    this.snackBar.open(message, 'Close', {
      duration: tone === 'error' ? 6000 : 3000,
      panelClass: [`${tone}-snackbar`],
    });
  }
}
