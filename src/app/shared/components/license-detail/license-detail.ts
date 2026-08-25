import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  output,
  signal,
} from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { License } from '../../../models/license.models';
import { LicenseService } from '../../../services/license.service';
import { describeError } from '../../utils/http-error';
import { saveBlob } from '../../utils/download';
import { formatIsoDateTime } from '../../utils/date-format';

export interface LicenseDetailData {
  license: License;
}

/**
 * Read-only view of one license, including the signed file body.
 *
 * Revoking is the caller's job, not this dialog's: the register and the catalog each
 * confirm it their own way and own the snackbar. This emits `revoked` and stays open;
 * the caller pushes the updated row back through `update()` so the pills refresh.
 *
 * The file body is fetched on open rather than carried in the list payload — a signed
 * license is a few KB and the register can hold thousands of rows.
 */
@Component({
  selector: 'app-license-detail',
  imports: [MatIconModule, MatDialogModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>License details</h2>

    @if (error(); as message) {
      <p class="alert alert-error dialog-alert" role="alert">{{ message }}</p>
    }

    <mat-dialog-content>
      <div class="detail-tags">
        <span class="pill" [class]="'pill--' + typeTone(license().type)">{{ license().type }}</span>
        <span class="pill" [class]="'pill--' + statusTone(license().status)">{{ license().status }}</span>
        <span class="pill pill--outlined">{{ license().licenseType }}</span>
      </div>

      <dl class="pairs">
        <dt>License ID</dt>
        <dd class="mono">{{ license().licenseId }}</dd>

        <dt>Customer</dt>
        <dd>{{ license().customerName }}</dd>

        <dt>{{ targetLabel() }}</dt>
        <dd class="mono">{{ license().targetId }}</dd>

        <dt>Application</dt>
        <dd>{{ license().applicationName }}</dd>

        <!-- Robot licenses always name their machine; gateway licenses optionally do.
             A machine license is its own machine, so the row would only repeat above. -->
        @if (license().type !== 'Machine') {
          <dt>Machine ID</dt>
          <dd class="mono">{{ license().machineId || '—' }}</dd>
        }

        <dt>Issued</dt>
        <dd class="tnum">{{ formatDate(license().issuedAt) }}</dd>

        <dt>Expires</dt>
        <dd class="tnum">
          {{ license().expiresAt ? formatDate(license().expiresAt!) : 'Perpetual' }}
        </dd>

        @if (license().createdBy) {
          <dt>Issued by</dt>
          <dd>{{ license().createdBy }}</dd>
        }

        @if (license().notes) {
          <dt>Notes</dt>
          <dd>{{ license().notes }}</dd>
        }

        @if (license().isRevoked) {
          <dt>Revoked</dt>
          <dd class="tnum">{{ license().revokedAt ? formatDate(license().revokedAt!) : '—' }}</dd>

          <dt>Reason</dt>
          <dd>{{ license().revokedReason || '—' }}</dd>
        }
      </dl>

      <div class="field">
        <span class="field-label">License file</span>
        @if (loading()) {
          <p class="muted">Loading…</p>
        } @else {
          <pre class="code-block mono">{{ fileContent() }}</pre>
        }
      </div>
    </mat-dialog-content>

    <mat-dialog-actions>
      <button type="button" matButton="outlined" mat-dialog-close>Close</button>
      <button
        type="button"
        matButton="outlined"
        [disabled]="!fileContent()"
        (click)="copy()"
      >
        {{ copied() ? 'Copied' : 'Copy' }}
      </button>
      @if (!license().isRevoked) {
        <button type="button" matButton="outlined" class="danger" (click)="revoked.emit(license())">
          Revoke
        </button>
      }
      <button
        type="button"
        matButton="filled"
        [disabled]="downloading()"
        (click)="download()"
      >
        {{ downloading() ? 'Downloading…' : 'Download' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .detail-tags {
        display: flex;
        flex-wrap: wrap;
        gap: var(--sp-2);
      }

      .pairs {
        display: grid;
        grid-template-columns: minmax(7rem, max-content) 1fr;
        gap: var(--sp-2) var(--sp-4);
        margin: 0;
        font-size: var(--fs-base);

        dt {
          color: var(--brand-text-muted);
          font-size: var(--fs-md);
        }

        dd {
          margin: 0;
          color: var(--brand-text-strong);
          overflow-wrap: anywhere;
        }
      }

      .code-block {
        margin: 0;
        max-height: 16rem;
        overflow: auto;
        padding: var(--sp-3);
        background: var(--brand-bg-alt);
        border: 1px solid var(--brand-border-soft);
        border-radius: var(--r-md);
        font-size: var(--fs-sm);
        line-height: 1.5;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
    `,
  ],
})
export class LicenseDetailComponent {
  private readonly licenses = inject(LicenseService);
  private readonly dialogRef = inject<MatDialogRef<LicenseDetailComponent>>(MatDialogRef);

  protected readonly license = signal(inject<LicenseDetailData>(MAT_DIALOG_DATA).license);

  readonly revoked = output<License>();

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

  /**
   * Replaces the license on show — the caller pushes the row back after revoking it, so the
   * open dialog is not left displaying the pre-revocation state.
   */
  update(license: License): void {
    this.license.set(license);
  }

  /** Closes the dialog from outside, e.g. when the caller navigates away from the row. */
  close(): void {
    this.dialogRef.close();
  }

  protected formatDate = formatIsoDateTime;

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

  protected async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.fileContent());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      // Clipboard access is blocked outside a secure context; the file is still on screen.
      this.error.set('Could not copy — select the text and copy manually.');
    }
  }

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
