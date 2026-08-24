import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { License } from '../../models/license.models';
import { LicenseService } from '../../services/license.service';
import { DataTableComponent } from '../../shared/components/data-table/data-table';
import { DataActionEvent } from '../../shared/models/data-table.models';
import { LicenseDetailComponent } from '../../shared/components/license-detail/license-detail';
import {
  ConfirmationDialogComponent,
  ConfirmationDialogData,
} from '../../shared/components/confirmation-dialog/confirmation-dialog';
import { describeError } from '../../shared/utils/http-error';
import { saveBlob } from '../../shared/utils/download';
import { buildLicensesTableConfig } from './licenses-table.config';

/**
 * The license register. The whole list is fetched once and filtered in the table, matching
 * the Users page — status is computed server-side, so filtering client-side cannot drift.
 */
@Component({
  selector: 'app-licenses',
  imports: [MatSnackBarModule, DataTableComponent, LicenseDetailComponent],
  templateUrl: './licenses.html',
  styleUrl: './licenses.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Licenses {
  private readonly licenses = inject(LicenseService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  protected readonly rows = signal<License[]>([]);
  protected readonly loading = signal(true);
  protected readonly detail = signal<License | null>(null);

  private readonly queryParams = inject(ActivatedRoute).snapshot.queryParamMap;

  protected readonly tableConfig = buildLicensesTableConfig();

  /**
   * Seeds the table's search box from ?search=. The Customers page links here to show one
   * customer's licenses, and the global filter already matches on customer name, so this is
   * all that is needed - no customer-specific filter in the register itself.
   */
  protected readonly initialSearch = signal(this.queryParams.get('search') ?? '');

  /**
   * ?application= filters server-side by application key. Unlike the customer link, this
   * cannot be a text search - the key is not shown in any column, and two products could
   * share a display name prefix.
   */
  private readonly applicationFilter = this.queryParams.get('application') ?? undefined;

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);

    try {
      this.rows.set(await this.licenses.list({ application: this.applicationFilter }));
    } catch (error) {
      this.notify(describeError(error, 'Could not load licenses.'), 'error');
    } finally {
      this.loading.set(false);
    }
  }

  protected handleAction(event: DataActionEvent<License>): void {
    switch (event.action) {
      case 'add':
        void this.router.navigate(['/licenses/machine']);
        break;
      case 'refresh':
        void this.load();
        break;
      case 'view':
        if (event.row) this.detail.set(event.row);
        break;
      case 'download':
        if (event.row) void this.download(event.row);
        break;
      case 'revoke':
        if (event.row) void this.revoke(event.row);
        break;
    }
  }

  protected openDetail(row: License): void {
    this.detail.set(row);
  }

  private async download(license: License): Promise<void> {
    try {
      const blob = await this.licenses.download(license.id);
      saveBlob(blob, this.fileNameFor(license));
    } catch (error) {
      this.notify(describeError(error, 'Could not download the license file.'), 'error');
    }
  }

  /**
   * Revocation is confirmed because the customer already holds the signed file — this
   * registry is the only thing that says it is no longer valid.
   */
  protected async revoke(license: License): Promise<void> {
    const data: ConfirmationDialogData = {
      title: 'Revoke license?',
      message:
        `This marks the ${license.type.toLowerCase()} license for ${license.customerName} ` +
        `(${license.targetId}) as revoked. Verification will fail for this target.`,
      icon: 'block',
      confirmText: 'Revoke license',
      cancelText: 'Cancel',
      showCancel: true,
      confirmColor: 'warn',
    };

    const confirmed = await firstValueFrom(
      this.dialog.open(ConfirmationDialogComponent, { data, width: '440px' }).afterClosed(),
    );

    if (!confirmed) return;

    try {
      const updated = await this.licenses.revoke(license.id, null);
      this.rows.update((list) => list.map((l) => (l.id === updated.id ? updated : l)));

      // The open detail modal would otherwise still show the pre-revocation state.
      if (this.detail()?.id === updated.id) {
        this.detail.set(updated);
      }

      this.notify(`License for ${updated.customerName} was revoked.`, 'success');
    } catch (error) {
      this.notify(describeError(error, 'Could not revoke the license.'), 'error');
    }
  }

  /** Mirrors the server's naming, so a row download matches a freshly generated file. */
  private fileNameFor(license: License): string {
    const safe = license.targetId.replace(/[^A-Za-z0-9_-]/g, '') || 'license';
    return license.type === 'Gateway' ? `gateway_${safe.slice(0, 8)}.lic` : `${safe}.lic`;
  }

  private notify(message: string, tone: 'success' | 'error'): void {
    this.snackBar.open(message, 'Close', {
      duration: tone === 'error' ? 6000 : 3000,
      panelClass: [`${tone}-snackbar`],
    });
  }
}
