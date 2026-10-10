import { ChangeDetectionStrategy, Component, effect, inject, output, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { License } from '../../../models/license.models';
import { LicenseService } from '../../../services/license.service';
import { AuthService } from '../../../services/auth.service';
import { describeError } from '../../utils/http-error';
import { saveBlob } from '../../utils/download';
import { formatIsoDateTime } from '../../utils/date-format';

export interface LicenseDetailData {
  license: License;
}

/** Displays one license with its signed file and offers copy, download and delete actions. */
@Component({
  selector: 'app-license-detail',
  imports: [MatIconModule, MatDialogModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './license-detail.html',
  styleUrl: './license-detail.scss',
})
export class LicenseDetailComponent {
  private readonly licenses = inject(LicenseService);
  private readonly dialogRef = inject<MatDialogRef<LicenseDetailComponent>>(MatDialogRef);

  protected readonly license = signal(inject<LicenseDetailData>(MAT_DIALOG_DATA).license);

  /** Only a SuperAdmin may delete licenses. */
  protected readonly canDelete = inject(AuthService).isSuperAdmin;

  /** Emits when the user asks to delete the license; the host confirms and deletes it. */
  readonly deleted = output<License>();

  protected readonly fileContent = signal('');
  protected readonly fileName = signal('license.lic');
  protected readonly loading = signal(true);
  protected readonly downloading = signal(false);
  protected readonly copied = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      const id = this.license().id;
      void this.load(id);
    });
  }

  /** Closes the dialog. */
  close(): void {
    this.dialogRef.close();
  }

  protected formatDate = formatIsoDateTime;

  /** Returns the label for the target ID row based on the license type. */
  protected targetLabel(): string {
    switch (this.license().type) {
      case 'Robot':
        return 'Robot ID';
      case 'Gateway':
        return 'Device ID';
      default:
        return 'Machine ID';
    }
  }

  /** Returns the pill tone for a license type. */
  protected typeTone(type: License['type']): string {
    return type === 'Machine' ? 'info' : type === 'Robot' ? 'success' : 'neutral';
  }

  /** Returns the pill tone for a license status. */
  protected statusTone(status: License['status']): string {
    switch (status) {
      case 'Active':
        return 'success';
      case 'Expiring':
        return 'warning';
      case 'Expired':
        return 'danger';
      default:
        return 'neutral';
    }
  }

  /** Loads the signed license file for the given license. */
  private async load(id: number): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const detail = await this.licenses.get(id);
      this.fileContent.set(detail.licenseFileContent);
      this.fileName.set(detail.fileName);
    } catch (error) {
      this.error.set(describeError(error, 'Could not load the license file.'));
    } finally {
      this.loading.set(false);
    }
  }

  /** Copies the license file content to the clipboard. */
  protected async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.fileContent());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      this.error.set('Could not copy — select the text and copy manually.');
    }
  }

  /** Downloads the signed license file. */
  protected async download(): Promise<void> {
    this.downloading.set(true);

    try {
      saveBlob(await this.licenses.download(this.license().id), this.fileName());
    } catch (error) {
      this.error.set(describeError(error, 'Could not download the license file.'));
    } finally {
      this.downloading.set(false);
    }
  }
}
