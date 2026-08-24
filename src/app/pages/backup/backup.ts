import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header';
import {
  ConfirmationDialogComponent,
  ConfirmationDialogData,
} from '../../shared/components/confirmation-dialog/confirmation-dialog';
import { BackupService, ImportMode, ImportResult } from '../../services/backup.service';
import { describeError } from '../../shared/utils/http-error';
import { saveBlob } from '../../shared/utils/download';

/**
 * Backup and restore of the license register.
 *
 * Also the migration path off the desktop app: an import accepts the desktop's own .licdb
 * archive, not just one this system produced.
 */
@Component({
  selector: 'app-backup',
  imports: [MatSnackBarModule, PageHeaderComponent],
  templateUrl: './backup.html',
  styleUrl: './backup.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Backup {
  private readonly backup = inject(BackupService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  protected readonly recordCount = signal<number | null>(null);
  protected readonly exporting = signal(false);
  protected readonly importing = signal(false);
  protected readonly selectedFile = signal<File | null>(null);
  protected readonly mode = signal<ImportMode>('Merge');
  protected readonly result = signal<ImportResult | null>(null);
  protected readonly error = signal<string | null>(null);

  constructor() {
    void this.loadStatus();
  }

  protected async loadStatus(): Promise<void> {
    try {
      this.recordCount.set((await this.backup.status()).recordCount);
    } catch (error) {
      this.error.set(describeError(error, 'Could not read the register status.'));
    }
  }

  protected async exportBackup(): Promise<void> {
    this.exporting.set(true);
    this.error.set(null);

    try {
      const blob = await this.backup.export();
      const stamp = new Date().toISOString().slice(0, 10);
      saveBlob(blob, `qynix-licenses-${stamp}.licdb`);
      this.notify('Backup downloaded.', 'success');
    } catch (error) {
      this.error.set(describeError(error, 'Could not export the register.'));
    } finally {
      this.exporting.set(false);
    }
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile.set(input.files?.[0] ?? null);
    this.result.set(null);
    this.error.set(null);
  }

  protected setMode(mode: ImportMode): void {
    this.mode.set(mode);
  }

  protected clearFile(input: HTMLInputElement): void {
    input.value = '';
    this.selectedFile.set(null);
    this.result.set(null);
  }

  protected formatSize(bytes: number): string {
    return bytes < 1024
      ? `${bytes} B`
      : bytes < 1024 * 1024
        ? `${(bytes / 1024).toFixed(1)} KB`
        : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  protected async runImport(): Promise<void> {
    const file = this.selectedFile();
    if (!file || this.importing()) return;

    // Replace deletes every existing record, so it is confirmed; merge is additive and is not.
    if (this.mode() === 'Replace') {
      const data: ConfirmationDialogData = {
        title: 'Replace the whole register?',
        message:
          `This permanently deletes all ${this.recordCount() ?? 0} license records and ` +
          `restores from ${file.name}. Export a backup first if you might need the current data.`,
        icon: 'warning',
        confirmText: 'Replace everything',
        cancelText: 'Cancel',
        showCancel: true,
        confirmColor: 'warn',
      };

      const confirmed = await firstValueFrom(
        this.dialog.open(ConfirmationDialogComponent, { data, width: '440px' }).afterClosed(),
      );

      if (!confirmed) return;
    }

    this.importing.set(true);
    this.error.set(null);
    this.result.set(null);

    try {
      const result = await this.backup.import(file, this.mode());
      this.result.set(result);
      await this.loadStatus();
      this.notify(`Imported ${result.imported}, skipped ${result.skipped}.`, 'success');
    } catch (error) {
      this.error.set(describeError(error, 'Could not import the backup.'));
    } finally {
      this.importing.set(false);
    }
  }

  private notify(message: string, tone: 'success' | 'error'): void {
    this.snackBar.open(message, 'Close', {
      duration: tone === 'error' ? 6000 : 3000,
      panelClass: [`${tone}-snackbar`],
    });
  }
}
