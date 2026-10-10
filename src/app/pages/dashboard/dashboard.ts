import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import {
  LicenseDetailComponent,
  LicenseDetailData,
} from '../../shared/components/license-detail/license-detail';
import { LicenseService } from '../../services/license.service';
import { License, LicenseStatus } from '../../models/license.models';
import { PillTone } from '../../shared/models/pill.models';
import { dialogConfig } from '../../shared/utils/dialog';
import { describeError } from '../../shared/utils/http-error';
import { formatIsoDateTime } from '../../shared/utils/date-format';
import {
  countByType,
  countStatuses,
  expiryLabel,
  filterByStatus,
  needingAttention,
  percentOf,
} from './license-status';

/** One status tile, legend entry and filter chip. */
interface StatusEntry {
  status: LicenseStatus;
  label: string;
  tone: PillTone;
  count: number;
  percent: number;
}

/** Landing page that shows the status of every license in the register. */
@Component({
  selector: 'app-dashboard',
  imports: [MatIconModule, MatSnackBarModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {
  private readonly licenseService = inject(LicenseService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  protected readonly licenses = signal<License[]>([]);
  protected readonly loading = signal(true);
  protected readonly statusFilter = signal<LicenseStatus | null>(null);

  protected readonly counts = computed(() => countStatuses(this.licenses()));
  protected readonly byType = computed(() => countByType(this.licenses()));
  protected readonly attention = computed(() => needingAttention(this.licenses()));
  protected readonly visible = computed(() => filterByStatus(this.licenses(), this.statusFilter()));

  protected readonly statuses = computed<StatusEntry[]>(() => {
    const c = this.counts();
    return [
      { status: 'Active', label: 'Active', tone: 'success', count: c.active },
      { status: 'Expiring', label: 'Expiring in 30 days', tone: 'warning', count: c.expiring },
      { status: 'Expired', label: 'Expired', tone: 'danger', count: c.expired },
    ].map((entry) => ({ ...entry, percent: percentOf(entry.count, c.total) }) as StatusEntry);
  });

  protected readonly formatDate = formatIsoDateTime;
  protected readonly expiryLabel = expiryLabel;
  protected readonly percentOf = percentOf;

  constructor() {
    void this.load();
  }

  /** Loads every license in the register. */
  protected async load(): Promise<void> {
    this.loading.set(true);

    try {
      this.licenses.set(await this.licenseService.list());
    } catch (error) {
      this.notify(describeError(error, 'Could not load the dashboard.'));
    } finally {
      this.loading.set(false);
    }
  }

  /** Shows only licenses with the given status, or all when null. */
  protected setFilter(status: LicenseStatus | null): void {
    this.statusFilter.set(status);
  }

  /** Opens the read-only license detail dialog. */
  protected openDetail(license: License): void {
    this.dialog.open(
      LicenseDetailComponent,
      dialogConfig<LicenseDetailData>({ license, hideDelete: true }, 'min(44rem, 96vw)'),
    );
  }

  /** Maps a license status to its pill tone. */
  protected statusTone(status: LicenseStatus): PillTone {
    return status === 'Active' ? 'success' : status === 'Expiring' ? 'warning' : 'danger';
  }

  /** Shows an error snackbar. */
  private notify(message: string): void {
    this.snackBar.open(message, 'Close', { duration: 6000, panelClass: ['error-snackbar'] });
  }
}
