import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { License } from '../../models/license.models';
import { LicenseService } from '../../services/license.service';
import { DataTableComponent } from '../../shared/components/data-table/data-table';
import { DataActionEvent } from '../../shared/models/data-table.models';
import {
  LicenseDetailComponent,
  LicenseDetailData,
} from '../../shared/components/license-detail/license-detail';
import {
  ConfirmationDialogComponent,
  ConfirmationDialogData,
} from '../../shared/components/confirmation-dialog/confirmation-dialog';
import { dialogConfig } from '../../shared/utils/dialog';
import { describeError } from '../../shared/utils/http-error';
import { saveBlob } from '../../shared/utils/download';
import { buildLicensesTableConfig } from './licenses-table.config';

/** Page that lists the license register. */
@Component({
  selector: 'app-licenses',
  imports: [MatSnackBarModule, DataTableComponent],
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

  /** Open detail dialog, updated in place after a revoke. */
  private detailRef: MatDialogRef<LicenseDetailComponent> | null = null;

  private readonly queryParams = inject(ActivatedRoute).snapshot.queryParamMap;

  protected readonly tableConfig = buildLicensesTableConfig();

  /** Initial table search from the ?search= query parameter. */
  protected readonly initialSearch = signal(this.queryParams.get('search') ?? '');

  /** Application key from ?application=, filtered server-side. */
  private readonly applicationFilter = this.queryParams.get('application') ?? undefined;

  constructor() {
    void this.load();
  }

  /** Loads the licenses, filtered by application when one is given. */
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

  /** Dispatches a table action. */
  protected handleAction(event: DataActionEvent<License>): void {
    switch (event.action) {
      case 'add':
        void this.router.navigate(['/licenses/machine']);
        break;
      case 'refresh':
        void this.load();
        break;
      case 'view':
        if (event.row) this.openDetail(event.row);
        break;
      case 'download':
        if (event.row) void this.download(event.row);
        break;
      case 'revoke':
        if (event.row) void this.revoke(event.row);
        break;
    }
  }

  /** Opens the license detail dialog. */
  protected openDetail(row: License): void {
    const ref = this.dialog.open(
      LicenseDetailComponent,
      dialogConfig<LicenseDetailData>({ license: row }, 'min(44rem, 96vw)'),
    );

    ref.componentInstance.revoked.subscribe((license) => void this.revoke(license));

    this.detailRef = ref;
    ref.afterClosed().subscribe(() => {
      if (this.detailRef === ref) this.detailRef = null;
    });
  }

  /** Downloads a license file. */
  private async download(license: License): Promise<void> {
    try {
      const blob = await this.licenses.download(license.id);
      saveBlob(blob, this.fileNameFor(license));
    } catch (error) {
      this.notify(describeError(error, 'Could not download the license file.'), 'error');
    }
  }

  /** Revokes a license after confirmation. */
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
      this.detailRef?.componentInstance.update(updated);

      this.notify(`License for ${updated.customerName} was revoked.`, 'success');
    } catch (error) {
      this.notify(describeError(error, 'Could not revoke the license.'), 'error');
    }
  }

  /** Builds the download file name the same way the server does. */
  private fileNameFor(license: License): string {
    const safe = license.targetId.replace(/[^A-Za-z0-9_-]/g, '') || 'license';
    return license.type === 'Gateway' ? `gateway_${safe.slice(0, 8)}.lic` : `${safe}.lic`;
  }

  /** Shows a success or error snackbar. */
  private notify(message: string, tone: 'success' | 'error'): void {
    this.snackBar.open(message, 'Close', {
      duration: tone === 'error' ? 6000 : 3000,
      panelClass: [`${tone}-snackbar`],
    });
  }
}
